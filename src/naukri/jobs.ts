import type { NaukriAuth } from './auth.ts';
import { APPLY_SOURCES, HEADERS, URLS } from './constants.ts';
import { NaukriAuthError } from './errors.ts';
import { compact, readJson, type Http } from './http.ts';
import { buildSeoKey, generateNkparam, newSid, parseJob } from './parsers.ts';
import type { ApplyParams, Job, SearchParams } from './types.ts';

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
  }: SearchParams): Promise<Job[]> {
    const res = await this.#http.get(URLS.search, {
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
    if (res.statusCode === 406) return [];
    const data = readJson(res, 'Job search');
    return (data.jobDetails ?? data.jobs ?? []).map(parseJob);
  }

  /** Raw job details plus whether applying redirects to the company's own site. */
  async details(jobId: string, sid = newSid()) {
    const res = await this.#http.get(URLS.jobDetails(jobId), {
      headers: await this.#auth.authHeaders({
        ...HEADERS.jobApi,
        nkparam: generateNkparam('srp'),
        referer: 'https://www.naukri.com/',
      }),
      params: { microsite: 'y', src: 'jobsearchDesk', sid, xp: '1', px: '1' },
    });
    const details = readJson(res, 'Job details');
    return { externalApply: details?.job?.responseManager === 'companyUrl', details };
  }

  /**
   * Easy-apply. If Naukri answers with a questionnaire, call again with `answers`
   * keyed by questionId (text → string, options → array of option keys).
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
        ...(answers && { applyData: { [jobId]: { answers } } }),
      },
    });
    const result = readJson(res, 'Apply');
    const questionnaire = result?.jobs?.[0]?.questionnaire;
    return { questionnaireRequired: Array.isArray(questionnaire) && questionnaire.length > 0, result };
  }
}
