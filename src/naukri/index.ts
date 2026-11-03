import { NaukriAuth, type Credentials } from './auth.ts';
import { createHttp } from './http.ts';
import { NaukriJobs } from './jobs.ts';
import { NaukriProfile } from './profile.ts';

export interface NaukriClientOptions extends Credentials {
  /** e.g. http://user:pass@host:port or socks5://host:port. Naukri flags most datacenter IPs. */
  proxy?: string;
}

/** Composition root for the standalone client: one shared HTTP session, one logged-in user. */
export function createNaukriClient({ proxy, ...creds }: NaukriClientOptions) {
  const http = createHttp(proxy);
  const auth = new NaukriAuth(http, creds);
  return {
    auth,
    profile: new NaukriProfile(http, auth),
    jobs: new NaukriJobs(http, auth),
    close: () => http.close(),
  };
}

export type NaukriClient = ReturnType<typeof createNaukriClient>;

export { NaukriAuth, NaukriJobs, NaukriProfile };
export * from './errors.ts';
export type * from './types.ts';
