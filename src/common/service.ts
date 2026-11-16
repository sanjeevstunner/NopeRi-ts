import type { Http } from './http.ts';

/** Base for a site's services (jobs, profile): the shared HTTP session plus that site's auth. */
export abstract class SiteService<A> {
  protected readonly http: Http;
  protected readonly auth: A;

  constructor(http: Http, auth: A) {
    this.http = http;
    this.auth = auth;
  }
}
