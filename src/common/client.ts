import { createHttp, type Http } from './http.ts';
import type { Credentials } from './tokenAuth.ts';

export interface ClientOptions extends Credentials {
  /** e.g. http://user:pass@host:port or socks5://host:port. Naukri sites flag most datacenter IPs. */
  proxy?: string;
}

/** Composition root for one site: one HTTP session (own cookies), one logged-in user, and that site's services. */
export function createClient<A, P, J>(
  { proxy, ...creds }: ClientOptions,
  Auth: new (http: Http, creds: Credentials) => A,
  Profile: new (http: Http, auth: A) => P,
  Jobs: new (http: Http, auth: A) => J,
) {
  const http = createHttp(proxy);
  const auth = new Auth(http, creds);
  return { auth, profile: new Profile(http, auth), jobs: new Jobs(http, auth), close: () => http.close() };
}
