import { compact, ensureOk, readJson, type Http } from '../naukri/http.ts';
import { NaukriUpstreamError } from '../naukri/errors.ts';
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

  /**
   * Easy-apply. Reads the job first to copy `jobSource`/`isFormBasedApply` like the web app does, then POSTs the apply.
   * Already-applied jobs return `applied: true` without a request. A 400 from NaukriGulf (extra step such as a
   * questionnaire or profile gap) comes back as `applied: false` with its `layerCode`.
   * ponytail: payload copied from the site's JS (getApplyRequestPayload); not yet verified against a live apply.
   */
  async apply({ jobId, xz = '', source = 'self' }: { jobId: string; xz?: string; source?: string }) {
    const job = (await this.details(jobId))?.Job;
    if (!job) throw new NaukriUpstreamError('Job details response has no Job');
    if (job.Other?.IsApplied === 'true' || job.Other?.IsApplied === true) return { applied: true, alreadyApplied: true };
    const res = await this.#http.post(URLS.apply, {
      headers: await this.#auth.authHeaders(),
      params: { locationId: '', nationality: '' },
      json: {
        xz,
        isFormBasedApply: job.Other?.isFormBasedApply === 'true' || job.Other?.isFormBasedApply === true ? '1' : '0',
        jobId,
        jobType: job.Other?.jobSource ?? '',
        source,
        QUPChecked: '',
        applyReadyStatus: 'notDefined',
      },
    });
    if (res.statusCode === 400) {
      let data: any = {};
      try {
        data = res.json();
      } catch {}
      return { applied: false, status: 400, layerCode: data.layerCode ?? null, message: data.message ?? null, result: data };
    }
    ensureOk(res, 'Apply');
    let result: any = null;
    try {
      result = res.json();
    } catch {}
    // 307 means the job continues on an external site, not a completed apply.
    return { applied: res.statusCode === 200 && result?.status !== 307, status: result?.status ?? res.statusCode, result };
  }
}
