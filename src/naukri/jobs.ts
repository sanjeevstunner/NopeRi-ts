import type { NaukriAuth } from './auth.ts';
import { APPLY_SOURCES, FILTER_PARAMS, HEADERS, URLS } from './constants.ts';
import { NaukriAuthError, NaukriUpstreamError } from './errors.ts';
import { compact, readJson, type Http } from './http.ts';
import { buildSeoKey, generateNkparam, newSid, parseJob, parseQuestionnaire, parseSkills } from './parsers.ts';
import type { ApplyParams, Cluster, Job, SearchParams, SearchResult } from './types.ts';

/** Job search, recommendations, details and apply. */
export class NaukriJobs {
  readonly #http: Http;
  readonly #auth: NaukriAuth;

  constructor(http: Http, auth: NaukriAuth) {
    this.#http = http;
    this.#auth = auth;
  }

  async recommended(): Promise<Job[]> {
    const now = new Date().toISOString();
    const res = await this.#http.post(URLS.recommended, {
      headers: await this.#auth.authHeaders(),
      json: {
        clusterId: null,
        src: 'recommClusterApi',
        clusterSplitDate: { apply: now, preference: now, profile: now, similar_jobs: now },
      },
    });
    const data = readJson(res, 'Recommended jobs');
    return (data.jobDetails ?? []).map(parseJob);
  }

  /** Public search; needs a signed nkparam header but no login. */
  async search({
    keyword,
    location = '',
    page = 1,
    jobAge,
    experience,
    resultsPerPage = 20,
    latLong,
    filters = {},
  }: SearchParams): Promise<SearchResult> {
    const fq = filterQuery(filters);
    const res = await this.#http.get(fq ? `${URLS.search}?${fq}` : URLS.search, {
      headers: {
        ...HEADERS.base,
        'accept-language': 'en-US,en;q=0.9',
        appid: '109',
        gid: 'LOCATION,INDUSTRY,EDUCATION,FAREA_ROLE',
        nkparam: generateNkparam('srp'),
      },
      params: compact({
        noOfResults: resultsPerPage,
        urlType: 'search_by_keyword',
        searchType: 'adv',
        keyword,
        k: keyword,
        location,
        l: location,
        pageNo: page,
        experience,
        jobAge,
        nignbevent_src: 'jobsearchDeskGNB',
        seoKey: buildSeoKey(keyword, location, page),
        src: 'jobsearchDesk',
        latLong,
      }),
    });
    if (res.statusCode === 403) throw new NaukriAuthError('Search rejected (nkparam likely invalid)', 403, res.text);
    // 406 is Naukri's validation error for unsupported filter combinations: treat as no results.
    if (res.statusCode === 406) return { jobs: [], total: 0, clusters: {}, clusterOrder: [] };
    const data = readJson(res, 'Job search');
    const jobs = (data.jobDetails ?? data.jobs ?? []).map(parseJob);
    const clusters = pickClusters(data.clusters);
    // clusterOrder lists every group Naukri knows; keep the ones we got, then any it left out.
    const order = (data.clusterOrder ?? []).filter((k: string) => k in clusters);
    const clusterOrder = [...order, ...Object.keys(clusters).filter((k) => !order.includes(k))];
    return { jobs, total: Number(data.noOfJobs) || jobs.length, clusters, clusterOrder };
  }

  /** Raw job details plus whether applying redirects to the company's own site. */
  async details(jobId: string, sid = newSid()) {
    const res = await this.#http.get(URLS.jobDetails(jobId), {
      headers: await this.#auth.authHeaders({
        ...HEADERS.jobApi,
        gid: 'LOCATION,INDUSTRY,EDUCATION,FAREA_ROLE',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-mode': 'cors',
        'sec-fetch-dest': 'empty',
        // Job pages sign the job id itself; a "srp"-signed token gets 406 "recaptcha required".
        nkparam: generateNkparam(jobId),
        referer: 'https://www.naukri.com/',
      }),
      params: { microsite: 'y', brandedConsultantJd: 'true', amboxConsultantData: 'true', src: 'jobsearchDesk', sid },
    });
    const details = readJson(res, 'Job details');
    const job = details?.jobDetails;
    if (!job || typeof job !== 'object') throw new NaukriUpstreamError('Job details response has no jobDetails', res.statusCode, res.text);
    // Company-site jobs carry both URLs; Naukri-apply jobs have neither.
    return { externalApply: Boolean(job.applyRedirectUrl || job.companyApplyUrl), skills: parseSkills(job), details };
  }

  /**
   * Easy-apply. If Naukri answers with a questionnaire, call again with the same `sid`
   * and `answers` keyed by questionId (text → string, options → array of option labels).
   */
  async apply({ jobId, mandatorySkills = [], optionalSkills = [], sid = newSid(), source = 'recommended', answers }: ApplyParams) {
    const { applySrc, logstr } = APPLY_SOURCES[source];
    const res = await this.#http.post(URLS.apply, {
      headers: await this.#auth.authHeaders({ ...HEADERS.jobApi, systemid: 'jobseeker' }),
      json: {
        strJobsarr: [jobId],
        logstr: logstr(sid),
        flowtype: 'show',
        crossdomain: true,
        jquery: 1,
        rdxMsgId: '',
        chatBotSDK: true,
        mandatory_skills: mandatorySkills,
        optional_skills: optionalSkills,
        applyTypeId: '107',
        closebtn: 'y',
        applySrc,
        sid,
        mid: '',
        ...(answers && { applyData: { [jobId]: { answers } }, qupData: {} }),
      },
    });
    const result = readJson(res, 'Apply');
    const questionnaire = parseQuestionnaire(result);
    // Success is `applyStatus: { [jobId]: 200 }` with jobs[0] "You have successfully applied to this job."
    const job = result?.jobs?.[0];
    const applied = result?.applyStatus?.[jobId] === 200 || job?.status === 200;
    // The answers go with the same sid in the second call, as the browser does.
    return { applied, message: typeof job?.message === 'string' ? job.message : null, sid, questionnaireRequired: questionnaire.length > 0, questionnaire, result };
  }
}

/** Repeated query params (`wfhType=0&wfhType=2`), which httpcloak's `params` can't express. */
export function filterQuery(filters: Record<string, string[]>): string {
  const q = new URLSearchParams();
  for (const [key, ids] of Object.entries(filters)) {
    const param = FILTER_PARAMS[key];
    if (param) for (const id of ids) q.append(param, id);
  }
  return q.toString();
}

/** Keeps only the filter groups we can send back, as clean `{id,count,label}` lists. */
export function pickClusters(raw: unknown): Record<string, Cluster[]> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, Cluster[]> = {};
  for (const [key, list] of Object.entries(raw)) {
    if (!(key in FILTER_PARAMS) || !Array.isArray(list) || !list.length) continue;
    out[key] = list.map((c) => ({ id: String(c.id), count: Number(c.count) || 0, label: String(c.label) }));
  }
  return out;
}
