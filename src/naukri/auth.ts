import { HEADERS, URLS } from './constants.ts';
import { NaukriAuthError } from './errors.ts';
import type { Http } from './http.ts';
import { generateVid } from './vid.ts';

export interface Credentials {
  username: string;
  password: string;
}

const TOKEN_COOKIE = 'nauk_at';

/**
 * Owns the Naukri login state. Other services only ask it for authenticated headers;
 * the first such call logs in with the configured credentials.
 */
export class NaukriAuth {
  readonly #http: Http;
  readonly #creds: Credentials;
  #token?: string;
  #loginTime?: Date;
  #expiresAt?: number;
  #pendingLogin?: Promise<void>;

  constructor(http: Http, creds: Credentials) {
    this.#http = http;
    this.#creds = creds;
  }

  get status() {
    return { loggedIn: this.#valid(), loginTime: this.#loginTime?.toISOString() ?? null };
  }

  async login(): Promise<void> {
    // Without vid Naukri may demand a CAPTCHA; if it can't be generated, try the login anyway.
    const vid = await generateVid().catch(() => undefined);
    const res = await this.#http.post(URLS.login, {
      headers: { ...HEADERS.login, ...(vid && { vid }) },
      json: { username: this.#creds.username, password: this.#creds.password },
    });
    if (!res.ok) throw new NaukriAuthError('Login failed', res.statusCode, res.text);
    this.#setToken(this.#http.getCookie(TOKEN_COOKIE)?.value);
  }

  /**
   * Adopts a `nauk_at` token copied from a logged-in browser. Use when Naukri demands a
   * CAPTCHA on login/OTP, which a server-side client cannot solve.
   */
  useToken(token: string): void {
    this.#http.setCookie(TOKEN_COOKIE, token, { domain: '.naukri.com', path: '/', secure: true });
    this.#setToken(token);
  }

  /** Asks Naukri to send a login OTP by SMS (`isMobile`) or email. */
  async sendOtp(username = this.#creds.username, isMobile = true): Promise<unknown> {
    const res = await this.#http.post(URLS.otpSend, {
      headers: { ...HEADERS.base, appid: '100' },
      json: otpPayload(username, isMobile),
    });
    if (!res.ok) throw new NaukriAuthError('Failed to send OTP', res.statusCode, res.text);
    try {
      return res.json();
    } catch {
      return {};
    }
  }

  async verifyOtp(otp: string, username = this.#creds.username, isMobile = true): Promise<void> {
    const res = await this.#http.post(URLS.otpVerify, {
      headers: HEADERS.otpVerify,
      json: { ...otpPayload(username, isMobile), token: otp },
    });
    if (!res.ok) throw new NaukriAuthError('OTP verification failed', res.statusCode, res.text);

    let token = this.#http.getCookie(TOKEN_COOKIE)?.value;
    if (!token) {
      // Some flows return the token in the body instead of a cookie.
      try {
        const body = res.json<{ authToken?: string; token?: string }>();
        token = body.authToken ?? body.token;
      } catch {}
    }
    this.#setToken(token);
  }

  /** Base headers plus bearer token, logging in first if needed. */
  async authHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
    await this.#ensureLoggedIn();
    return { ...HEADERS.base, authorization: `Bearer ${this.#token}`, systemid: 'Naukri', ...extra };
  }

  #ensureLoggedIn(): Promise<void> {
    if (this.#valid()) return Promise.resolve();
    // Concurrent first requests share one login instead of each starting their own.
    this.#pendingLogin ??= this.login().finally(() => (this.#pendingLogin = undefined));
    return this.#pendingLogin;
  }

  #setToken(token: string | undefined) {
    if (!token) throw new NaukriAuthError('Naukri did not return an auth token (OTP/MFA may be required)');
    this.#token = token;
    this.#loginTime = new Date();
    this.#expiresAt = jwtExpiry(token);
  }

  /** `nauk_at` is a JWT that dies ~1h after login; treat it as gone a minute early so in-flight calls don't 401. */
  #valid(): boolean {
    return Boolean(this.#token) && (this.#expiresAt === undefined || Date.now() < this.#expiresAt - 60_000);
  }
}

/** `exp` of a JWT in ms, or undefined if the token isn't a readable JWT. */
export function jwtExpiry(token: string): number | undefined {
  try {
    const { exp } = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString());
    return typeof exp === 'number' ? exp * 1000 : undefined;
  } catch {
    return undefined;
  }
}

function otpPayload(username: string, isMobile: boolean) {
  return { username, flowId: 'login', isLoginByEmail: !isMobile, isLoginByMobile: isMobile };
}
