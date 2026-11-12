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
  #pendingLogin?: Promise<void>;

  constructor(http: Http, creds: Credentials) {
    this.#http = http;
    this.#creds = creds;
  }

  get status() {
    return { loggedIn: Boolean(this.#loginTime), loginTime: this.#loginTime?.toISOString() ?? null };
  }

  async login(): Promise<void> {
    const res = await this.#http.post(URLS.login, { headers: HEADERS, json: { ...this.#creds } });
    if (!res.ok) throw new NaukriAuthError('NaukriGulf login failed', res.statusCode, res.text);
    this.#loginTime = new Date();
  }

  /** Common headers, logging in first if needed. */
  async authHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
    if (!this.#loginTime) {
      // Concurrent first requests share one login.
      this.#pendingLogin ??= this.login().finally(() => (this.#pendingLogin = undefined));
      await this.#pendingLogin;
    }
    return { ...HEADERS, ...extra };
  }
}
