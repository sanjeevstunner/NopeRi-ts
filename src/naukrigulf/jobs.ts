import { compact, ensureOk, readJson, type Http } from '../naukri/http.ts';
import { NaukriUpstreamError } from '../naukri/errors.ts';
import type { Job, SearchParams } from '../naukri/types.ts';
import type { GulfAuth } from './auth.ts';
import { FILTER_PARAMS, HEADERS, URLS } from './constants.ts';
import { parseJob, pickClusters } from './parsers.ts';

export type GulfSearchParams = Pick<SearchParams, 'keyword' | 'location' | 'page' | 'experience' | 'resultsPerPage' | 'filters'>;

/** Job search (public), recommendations and details. */
export class GulfJobs {
  readonly #http: Http;
  readonly #auth: GulfAuth;

  constructor(http: Http, auth: GulfAuth) {
    this.#http = http;
    this.#auth = auth;
  }

  async search({ keyword, location = '', page = 1, experience, resultsPerPage = 30, filters = {} }: GulfSearchParams) {
    const clusterParams = Object.fromEntries(
      Object.entries(filters).flatMap(([key, ids]) => (FILTER_PARAMS[key] && ids.length ? [[FILTER_PARAMS[key], ids.join(',')]] : [])),
    );
    const res = await this.#http.get(URLS.search, {
      headers: HEADERS,
      params: compact({
        ...clusterParams,
        clusterSelected: Object.keys(clusterParams).length ? 1 : undefined,
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
    return { jobs, total: Number(data.TotalJobsCount) || jobs.length, searchId: data.srchId ?? null, clusters: pickClusters(data.Clusters) };
  }

  /** Recommendations from every group (`apply`, `profile`, `JASP`, `jobalert`), de-duplicated by jobId. */
  async recommended(): Promise<Job[]> {
    const res = await this.#http.get(URLS.recommended, {
      headers: await this.#auth.authHeaders(),
      params: { applyFilter: false, jobTypeList: 'JASP', tabs: 'all' },
    });
    const data = readJson(res, 'Recommended jobs');
    const all: Job[] = (data.recommendation ?? []).flatMap((group: any) => (group.jobs ?? []).map(parseJob));
    return [...new Map(all.map((j) => [j.jobId, j])).values()];
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
