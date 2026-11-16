import { TokenAuth, type Credentials } from '../common/tokenAuth.ts';
import { NaukriAuthError } from '../naukri/errors.ts';
import type { Http } from '../naukri/http.ts';
import { HEADERS, URLS } from './constants.ts';

export type { Credentials };

/** NaukriGulf login. The session is carried by cookies (`AT`, a ~30min JWT) on the shared HTTP session. */
export class GulfAuth extends TokenAuth {
  readonly #http: Http;
  readonly #creds: Credentials;

  constructor(http: Http, creds: Credentials) {
    super();
    this.#http = http;
    this.#creds = creds;
  }

  async login(): Promise<void> {
    const res = await this.#http.post(URLS.login, { headers: HEADERS, json: { ...this.#creds } });
    if (!res.ok) throw new NaukriAuthError('NaukriGulf login failed', res.statusCode, res.text);
    this.loggedIn(this.#http.getCookie('AT')?.value);
  }

  /** Adopts the `AT` cookie (httpOnly JWT) copied from a logged-in browser, e.g. when the password login is blocked. */
  useToken(token: string): void {
    this.#http.setCookie('AT', token, { domain: '.naukrigulf.com', path: '/', secure: true });
    this.loggedIn(token);
  }

  /** Common headers, logging in first if needed. */
  async authHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
    await this.ensureLoggedIn();
    return { ...HEADERS, ...extra };
  }
}
