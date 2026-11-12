import type { NaukriAuth } from './auth.ts';
import { HEADERS, URLS } from './constants.ts';
import { NaukriUpstreamError } from './errors.ts';
import { ensureOk, readJson, type Http } from './http.ts';
import {
  appJsUrl,
  extractFormKey,
  fallbackMnjUrls,
  mnjUrl,
  mnjVersion,
  parseHistory,
  parseHistoryDetail,
  randomFileKey,
  scriptUrls,
} from './parsers.ts';
import type { ApplicationDetail, ApplicationHistory, HistoryParams, ProfileFields } from './types.ts';

/** Profile reads/writes: profile id, headline/name/summary, resume, application history. */
export class NaukriProfile {
  readonly #http: Http;
  readonly #auth: NaukriAuth;
  #profileId?: string;
  #formKey?: string;
  // ponytail: single in-process lock, fine for the one instance the README requires
  #swap: Promise<unknown> = Promise.resolve();

  constructor(http: Http, auth: NaukriAuth) {
    this.#http = http;
    this.#auth = auth;
  }

  async profileId(): Promise<string> {
    if (this.#profileId) return this.#profileId;
    const res = await this.#http.get(URLS.dashboard, { headers: await this.#auth.authHeaders() });
    const data = readJson(res, 'Fetch dashboard');
    const id = data.profileId ?? data.dashBoard?.profileId;
    if (!id) throw new NaukriUpstreamError('Profile id missing from dashboard response');
    return (this.#profileId = String(id));
  }

  async update(fields: ProfileFields) {
    const profileId = await this.profileId();
    const profile = Object.fromEntries(
      Object.entries({ resumeHeadline: fields.headline, name: fields.name, summary: fields.summary }).filter(
        ([, v]) => v !== undefined,
      ),
    );
    const res = await this.#http.post(URLS.profileUpdate, {
      headers: await this.#auth.authHeaders(
        HEADERS.profileWrite('https://www.naukri.com/mnjuser/profile?id=&altresid'),
      ),
      json: { profile, profileId },
    });
    return { profileId, response: readJson(res, 'Profile update') };
  }

  /** Uploads a PDF resume: validate the file with Naukri's file service, then attach it to the profile. */
  async uploadResume(file: Buffer, filename = 'resume.pdf') {
    const [profileId, formKey] = await Promise.all([this.profileId(), this.formKey()]);
    const fileKey = await this.#validateFile(file, filename, formKey);

    const res = await this.#http.post(URLS.resumeUpdate(profileId), {
      headers: await this.#auth.authHeaders(HEADERS.profileWrite('https://www.naukri.com/mnjuser/profile')),
      json: { textCV: { formKey, fileKey } },
    });
    return { profileId, response: readJson(res, 'Resume update') };
  }

  /** Naukri's full profile as-is: user, profile (incl. cvInfo), employments, educations, skills, projects, ... */
  async full(): Promise<Record<string, any>> {
    const headers = await this.#auth.authHeaders({ appid: '105' });
    return readJson(await this.#http.get(URLS.fullProfile, { headers }), 'Fetch profile');
  }

  /** The resume currently attached to the profile, with the filename Naukri shows for it. */
  async currentResume(): Promise<{ file: Buffer; filename: string }> {
    const headers = await this.#auth.authHeaders({ appid: '105' });
    const profile = (await this.full()).profile?.[0];
    const cv = profile?.cvInfo;
    if (!profile?.profileId || !cv?.isAvailable) throw new NaukriUpstreamError('No resume attached to the profile');

    const res = ensureOk(await this.#http.get(URLS.resumeDownload(profile.profileId), { headers }), 'Download resume');
    if (res.body.subarray(0, 5).toString() !== '%PDF-') {
      throw new NaukriUpstreamError('Downloaded resume is not a PDF', res.statusCode);
    }
    const filename = /\.pdf$/i.test(cv.fileName ?? '') ? cv.fileName : `${cv.fileName || 'resume'}.pdf`;
    return { file: res.body, filename };
  }

  /**
   * Runs `fn` with `file` as the profile resume, then puts the original back, even if `fn` throws.
   * Calls are serialised so two swaps never back up each other's tailored resume.
   */
  withResume<T>(file: Buffer, filename: string, fn: () => Promise<T>): Promise<T> {
    const run = this.#swap.then(async () => {
      const original = await this.currentResume();
      try {
        await this.uploadResume(file, filename);
        return await fn();
      } finally {
        await this.uploadResume(original.file, original.filename).catch((err) => {
          throw new NaukriUpstreamError(
            `Original resume "${original.filename}" was NOT restored: ${err.message}`,
            err.upstreamStatus,
          );
        });
      }
    });
    this.#swap = run.catch(() => {});
    return run;
  }

  async applicationHistory({
    pageSize = 10,
    days = 90,
    pageNumber = 1,
    mobile = false,
  }: HistoryParams = {}): Promise<ApplicationHistory[]> {
    const app = mobile ? '135' : '107';
    const headers = await this.#auth.authHeaders({
      appid: app,
      systemid: app,
      referer: mobile ? 'https://www.naukri.com/apply/historypage' : 'https://www.naukri.com/myapply/historypage',
      ...(mobile && { clientid: 'm0b5' }),
    });
    const params = { pageSize, days, pageNumber, ...(!mobile && { filterInfo: 2 }) };
    const res = await this.#http.get(URLS.history, { headers, params });
    return parseHistory(readJson(res, 'Fetch application history'));
  }

  async applicationDetail(jobId: string, applyType = 'normal'): Promise<ApplicationDetail> {
    const headers = await this.#auth.authHeaders({
      appid: '107',
      systemid: '107',
      referer: 'https://www.naukri.com/myapply/historypage',
    });
    const res = await this.#http.get(URLS.historyDescription, { headers, params: { jobId, applyType } });
    return parseHistoryDetail(readJson(res, 'Fetch application detail'));
  }

  /** Uploader form key scraped from Naukri's JS bundle. Cached for the process lifetime. */
  async formKey(): Promise<string> {
    if (this.#formKey) return this.#formKey;
    const page = await this.#http.get(URLS.profilePage, { headers: await this.#auth.authHeaders() });

    for (const url of await this.#mnjCandidates(page.text)) {
      const key = await this.#fetchText(url).then(extractFormKey, () => undefined);
      if (key) return (this.#formKey = key);
    }
    throw new NaukriUpstreamError('formKey not found in Naukri JS bundles');
  }

  /** mnj bundle URLs to try, best first: linked directly, discovered via app bundle, then known versions. */
  async #mnjCandidates(html: string): Promise<string[]> {
    const linked = scriptUrls(html).filter((u) => u.includes('mnj'));
    const appUrl = appJsUrl(html);
    const version = appUrl ? await this.#fetchText(appUrl).then(mnjVersion, () => undefined) : undefined;
    return [...new Set([...linked, ...(version ? [mnjUrl(version)] : []), ...fallbackMnjUrls()])];
  }

  async #fetchText(url: string): Promise<string> {
    const res = await this.#http.get(url);
    if (!res.ok) throw new NaukriUpstreamError(`GET ${url} failed`, res.statusCode);
    return res.text;
  }

  async #validateFile(file: Buffer, filename: string, formKey: string): Promise<string> {
    const fileKey = 'U' + randomFileKey(13);
    const res = await this.#http.post(URLS.fileValidation, {
      headers: HEADERS.upload,
      files: { file: { filename, content: file, contentType: 'application/pdf' } },
      data: { formKey, fileName: filename, uploadCallback: 'true', fileKey },
    });
    if (!res.ok) throw new NaukriUpstreamError('Resume file validation failed', res.statusCode, res.text);
    try {
      // Naukri sometimes re-keys the upload; the response is keyed by the key it actually stored.
      const body = res.json<Record<string, unknown>>();
      return fileKey in body ? fileKey : (Object.keys(body)[0] ?? fileKey);
    } catch {
      return fileKey;
    }
  }
}
