import { compact, readJson, type Http } from '../naukri/http.ts';
import type { Job, SearchParams } from '../naukri/types.ts';
import type { GulfAuth } from './auth.ts';
import { HEADERS, URLS } from './constants.ts';
import { parseJob } from './parsers.ts';

export type GulfSearchParams = Pick<SearchParams, 'keyword' | 'location' | 'page' | 'experience' | 'resultsPerPage'>;

/** Job search (public), recommendations and details. */
export class GulfJobs {
  readonly #http: Http;
  readonly #auth: GulfAuth;

  constructor(http: Http, auth: GulfAuth) {
    this.#http = http;
    this.#auth = auth;
  }

  async search({ keyword, location = '', page = 1, experience, resultsPerPage = 30 }: GulfSearchParams) {
    const res = await this.#http.get(URLS.search, {
      headers: HEADERS,
      params: compact({
        Keywords: keyword,
        Location: location,
        Experience: experience,
        Limit: resultsPerPage,
        Offset: (page - 1) * resultsPerPage,
        pageNo: page,
        seo: 1,
      }),
    });
    const data = readJson(res, 'Job search');
    const jobs: Job[] = (data.Jobs ?? []).map(parseJob);
    return { jobs, total: Number(data.TotalJobsCount) || jobs.length, searchId: data.srchId ?? null };
  }

  async recommended(): Promise<Job[]> {
    const res = await this.#http.get(URLS.recommended, {
      headers: await this.#auth.authHeaders(),
      params: { applyFilter: false, jobTypeList: 'JASP', tabs: 'all' },
    });
    const data = readJson(res, 'Recommended jobs');
    // ponytail: response shape not mapped yet; surface raw until a sample with jobs is captured
    return data;
  }

  /** Raw job details as NaukriGulf returns them. */
  async details(jobId: string) {
    const res = await this.#http.get(URLS.job(jobId), {
      headers: await this.#auth.authHeaders(),
      params: { seo: 1, nationality: '', xz: '', source: 'self' },
    });
    return readJson(res, 'Job details');
  }
}
