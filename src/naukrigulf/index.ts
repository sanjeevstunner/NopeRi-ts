import { createHttp } from '../naukri/http.ts';
import { GulfAuth, type Credentials } from './auth.ts';
import { GulfJobs } from './jobs.ts';

export interface GulfClientOptions extends Credentials {
  proxy?: string;
}

/** NaukriGulf client: own HTTP session (own cookies), same Chrome fingerprint as the Naukri client. */
export function createGulfClient({ proxy, ...creds }: GulfClientOptions) {
  const http = createHttp(proxy);
  const auth = new GulfAuth(http, creds);
  return { auth, jobs: new GulfJobs(http, auth), close: () => http.close() };
}

export type GulfClient = ReturnType<typeof createGulfClient>;
