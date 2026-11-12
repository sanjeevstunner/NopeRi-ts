const BASE = 'https://www.naukrigulf.com';

export const URLS = {
  login: `${BASE}/nglogin/user/login`,
  profile: `${BASE}/ngprofile/user/self`,
  fullProfile: `${BASE}/ngprofile/aggregate/self/fullProfile`,
  cvAttachment: `${BASE}/ngprofile/user/self/cvAttachment`,
  search: `${BASE}/spapi/jobapi/search`,
  recommended: `${BASE}/spapi/jobapi/userjobrecommendations/aggregated`,
  job: (jobId: string) => `${BASE}/spapi/jobs/${encodeURIComponent(jobId)}`,
} as const;

/** Headers the NaukriGulf web app sends (appid 205 = desktop). Auth is cookie-based, so no bearer token. */
export const HEADERS: Record<string, string> = {
  accept: 'application/json',
  'accept-language': 'ENGLISH',
  appid: '205',
  'client-type': 'desktop',
  clientid: 'Engt0P',
  'content-type': 'application/json',
  'device-type': 'desktop',
  origin: BASE,
  referer: `${BASE}/`,
  source: 'any',
  systemid: '2323',
};
