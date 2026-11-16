import { jwtExpiry } from '../naukri/auth.ts';
import { NaukriAuthError } from '../naukri/errors.ts';
import type { Http } from '../naukri/http.ts';
import { HEADERS, URLS } from './constants.ts';

export interface Credentials {
  username: string;
  password: string;
}

/** NaukriGulf login. The session is carried by cookies on the shared HTTP session. */
export class GulfAuth {
  readonly #http: Http;
  readonly #creds: Credentials;
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
    const res = await this.#http.post(URLS.login, { headers: HEADERS, json: { ...this.#creds } });
    if (!res.ok) throw new NaukriAuthError('NaukriGulf login failed', res.statusCode, res.text);
    this.#loggedIn(this.#http.getCookie('AT')?.value);
  }

  /** Adopts the `AT` cookie (httpOnly JWT) copied from a logged-in browser, e.g. when the password login is blocked. */
  useToken(token: string): void {
    this.#http.setCookie('AT', token, { domain: '.naukrigulf.com', path: '/', secure: true });
    this.#loggedIn(token);
  }

  #loggedIn(token: string | undefined) {
    this.#loginTime = new Date();
    this.#expiresAt = token ? jwtExpiry(token) : undefined;
  }

  /** `AT` is a JWT that dies ~30min after login; treat it as gone a minute early so in-flight calls don't 401. */
  #valid(): boolean {
    return Boolean(this.#loginTime) && (this.#expiresAt === undefined || Date.now() < this.#expiresAt - 60_000);
  }

  /** Common headers, logging in first if needed. */
  async authHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
    if (!this.#valid()) {
      // Concurrent first requests share one login.
      this.#pendingLogin ??= this.login().finally(() => (this.#pendingLogin = undefined));
      await this.#pendingLogin;
    }
    return { ...HEADERS, ...extra };
  }
}
