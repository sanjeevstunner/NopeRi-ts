import { publicEncrypt, constants, randomInt } from 'node:crypto';
import { MNJ_FALLBACK_VERSIONS, NKPARAM_PUBLIC_KEY, STATIC_JS_BASE } from './constants.ts';
import type { ApplicationHistory, Job, JobSkills, Question } from './types.ts';

// Pure helpers: no I/O, so they are unit-tested directly.

/** Signed `nkparam` header required by the job search/details APIs. */
export function generateNkparam(pageType = 'srp', now = Date.now()): string {
  const plaintext = Buffer.from(`v0|${now}|121_${pageType}`);
  return publicEncrypt({ key: NKPARAM_PUBLIC_KEY, padding: constants.RSA_PKCS1_PADDING }, plaintext).toString('base64');
}

/** Search session id Naukri expects: UTC yyyyMMddHHmmss + 7 zeros. */
export function newSid(now = new Date()): string {
  return now.toISOString().replace(/\D/g, '').slice(0, 14) + '0000000';
}

/** `seoKey` param for search, e.g. "node-dot-js-developer-jobs-in-hyderabad-1". */
export function buildSeoKey(keyword: string, location: string, page: number): string {
  const kw = keyword
    .trim()
    .toLowerCase()
    .replaceAll('.', '-dot-')
    .replaceAll(' ', '-')
    .replaceAll('+', '-')
    .replace(/^-+|-+$/g, '');
  const loc = location.trim().toLowerCase().replaceAll(' ', '-');
  return loc ? `${kw}-jobs-in-${loc}-${page}` : `${kw}-jobs-${page}`;
}

export function randomFileKey(length: number): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return Array.from({ length }, () => chars[randomInt(chars.length)]).join('');
}

export function parseJob(raw: any): Job {
  // Search results carry display-ready labels in `placeholders`; salaryDetail is a structured object.
  const label = (type: string): string | undefined => raw.placeholders?.find((p: any) => p?.type === type)?.label;
  const text = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
  const jobId = String(raw.jobId ?? raw.id ?? '');
  const jdUrl = text(raw.jdURL);
  return {
    jobId,
    title: raw.title || raw.jobTitle || 'N/A',
    company: raw.companyName || raw.company || 'N/A',
    location: label('location') ?? 'N/A',
    experience: label('experience') ?? text(raw.experienceText) ?? text(raw.experience) ?? 'N/A',
    salary: label('salary') ?? text(raw.salary) ?? 'Not disclosed',
    postedDate: raw.footerPlaceholderLabel || raw.postedDate || 'N/A',
    applyLink: jdUrl
      ? new URL(jdUrl, 'https://www.naukri.com').href
      : `https://www.naukri.com/job-listings-${jobId}`,
    description: raw.jobDescription || '',
    tags: raw.tagsAndSkills ? String(raw.tagsAndSkills).split(',').map((t) => t.trim()) : [],
  };
}

/**
 * The questionnaire in an apply answer, in a stable shape; [] when there is none.
 * `skippable` questions are ones Naukri fills from the Naukri profile (CTC, notice period…):
 * the browser leaves them out of the final apply.
 */
export function parseQuestionnaire(result: any): Question[] {
  const raw = result?.jobs?.[0]?.questionnaire;
  if (!Array.isArray(raw)) return [];
  const skippable = new Set((result?.skippableQuestions ?? []).map(String));
  return raw.flatMap((q: any) => {
    if (q?.questionId == null) return [];
    const id = String(q.questionId);
    const kind = String(q.questionType ?? '').toLowerCase();
    const options = q.answerOption && typeof q.answerOption === 'object' ? q.answerOption : {};
    return [{
      id,
      text: String(q.questionName ?? '').trim(),
      type: kind === 'text box' ? ('text' as const) : kind.includes('check') ? ('multi' as const) : ('choice' as const),
      options: Object.fromEntries(Object.entries(options).map(([k, v]) => [k, String(v)])),
      required: q.isMandatory !== false,
      skippable: skippable.has(id),
      prefill: Array.isArray(q.prefillData) ? q.prefillData.map(String) : [],
    }];
  });
}

/**
 * Skills to send with an apply. Job details list them as `keySkills.preferred/other`;
 * otherwise fall back to upstream NopeRi's rule on `tagsAndSkills`: first two mandatory.
 */
export function parseSkills(job: any): JobSkills {
  const labels = (list: unknown) =>
    Array.isArray(list) ? list.map((s: any) => String(s?.label ?? s ?? '').trim()).filter(Boolean) : [];
  const mandatory = labels(job?.keySkills?.preferred);
  const optional = labels(job?.keySkills?.other);
  if (mandatory.length || optional.length) return { mandatory, optional };
  const tags = job?.tagsAndSkills ? String(job.tagsAndSkills).split(',').map((t) => t.trim()).filter(Boolean) : [];
  return { mandatory: tags.slice(0, 2), optional: tags.slice(2) };
}

export function parseHistory(raw: any): ApplicationHistory[] {
  return (raw?.applyDetails ?? []).map((item: any) => ({
    jobId: item.jobId,
    jobTitle: item.jobTitle,
    company: item.company,
    location: item.location,
    applyType: item.applyType,
    isOpen: item.isOpen === 'true' || item.isOpen === true,
    arsScore: item.arsScore ?? 0,
    starRating: item.starRating ?? '0',
    jobType: item.jobType ?? '',
    statuses: (item.status ?? []).map((s: any) => ({
      statusId: s.statusId,
      statusValue: s.statusValue,
      dateTime: s.dateTime,
    })),
    companyRating: item.companyRating?.AggregateRating ? Number(item.companyRating.AggregateRating) : null,
    logoPath: item.logoPath ?? null,
  }));
}

// --- formKey discovery -------------------------------------------------------
// The resume uploader's formKey lives in the mnj_vNNN.min.js bundle. The profile page
// only links app_vNNN.min.js, which carries a version map like `mnj:"_v323"`.

const absolute = (url: string) => (url.startsWith('//') ? `https:${url}` : url);

export function scriptUrls(html: string): string[] {
  return [...html.matchAll(/<script[^>]+src="([^"]*\.js[^"]*)"/g)].map((m) => absolute(m[1]));
}

export function appJsUrl(html: string): string | undefined {
  const m = html.match(/src="((?:https?:)?\/\/static\.naukimg\.com\/s\/5\/105\/j\/app_v\d+\.min\.js)"/);
  return m ? absolute(m[1]) : undefined;
}

export function mnjVersion(appJs: string): string | undefined {
  return appJs.match(/\bmnj\s*:\s*"(_v\d+)"/)?.[1];
}

export const mnjUrl = (version: string) => `${STATIC_JS_BASE}mnj${version}.min.js`;
export const fallbackMnjUrls = () => MNJ_FALLBACK_VERSIONS.map(mnjUrl);

export function extractFormKey(js: string): string | undefined {
  return js.match(/key:"initUploader".*?d\s*=\s*"([A-Za-z0-9]+)"/s)?.[1] ?? js.match(/d\s*=\s*"([A-Za-z0-9]{10,})"/)?.[1];
}
