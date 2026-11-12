export const URLS = {
  login: 'https://www.naukri.com/central-login-services/v1/login',
  otpSend: 'https://www.naukri.com/central-login-services/v1/otp',
  otpVerify: 'https://www.naukri.com/central-login-services/v0/otp-login',
  profilePage: 'https://www.naukri.com/mnjuser/profile',
  fileValidation: 'https://filevalidation.naukri.com/file',
  dashboard: 'https://www.naukri.com/cloudgateway-mynaukri/resman-aggregator-services/v0/users/self/dashboard',
  profileUpdate: 'https://www.naukri.com/cloudgateway-mynaukri/resman-aggregator-services/v1/users/self/fullprofiles',
  fullProfile: 'https://www.naukri.com/cloudgateway-mynaukri/resman-aggregator-services/v2/users/self?expand_level=4',
  resumeDownload: (profileId: string) =>
    `https://www.naukri.com/cloudgateway-mynaukri/resman-aggregator-services/v1/users/self/profiles/${profileId}/resume`,
  resumeUpdate: (profileId: string) =>
    `https://www.naukri.com/cloudgateway-mynaukri/resman-aggregator-services/v0/users/self/profiles/${profileId}/advResume`,
  history: 'https://www.naukri.com/cloudgateway-apply/whtma-services/v0/applyapi/v5/history',
  historyDescription: 'https://www.naukri.com/cloudgateway-apply/whtma-services/v0/applyapi/v3/history-description',
  search: 'https://www.naukri.com/jobapi/v3/search',
  recommended: 'https://www.naukri.com/jobapi/v2/search/recom-jobs',
  jobDetails: (jobId: string) => `https://www.naukri.com/jobapi/v4/job/${encodeURIComponent(jobId)}`,
  apply: 'https://www.naukri.com/cloudgateway-workflow/workflow-services/apply-workflow/v1/apply',
} as const;

/** Search filter cluster key (as returned in `clusters`) → the query param Naukri filters on. Each verified live against cluster counts; `employement` left out (param unknown). */
export const FILTER_PARAMS: Record<string, string> = {
  wfhType: 'wfhType',
  citiesGid: 'cityTypeGid',
  functionalAreaGid: 'functionAreaIdGid',
  salaryRange: 'ctcFilter',
  business_size: 'qbusinessSize',
  glbl_RoleCat: 'glbl_qcrc',
  ugCourseGid: 'ugTypeGid',
  pgCourseGid: 'pgTypeGid',
  industryTypeGid: 'industryTypeIdGid',
  topGroupId: 'qctopGroupId',
};

export const STATIC_JS_BASE = 'https://static.naukimg.com/s/5/105/j/';
/** Last-known-good mnj bundle versions, tried only if discovery fails. Newest first. */
export const MNJ_FALLBACK_VERSIONS = ['_v323', '_v299'];

type Headers = Record<string, string>;

const BASE: Headers = {
  accept: 'application/json',
  appid: '103',
  clientid: 'd3skt0p',
  'content-type': 'application/json',
  referer: 'https://www.naukri.com/',
  systemid: 'jobseeker',
  'x-requested-with': 'XMLHttpRequest',
};

export const HEADERS = {
  base: BASE,
  login: { ...BASE, appid: '105' },
  otpVerify: {
    ...BASE,
    appid: '100',
    referer: 'https://www.naukri.com/nlogin/login?URL=//www.naukri.com/mnjuser/recommendedjobs',
  },
  upload: {
    accept: 'application/json, text/javascript, */*; q=0.01',
    appid: '105',
    origin: 'https://www.naukri.com',
    referer: 'https://www.naukri.com/',
    systemid: 'fileupload',
  },
  /** Profile writes go through POST with a PUT method override. */
  profileWrite: (referer: string): Headers => ({
    'accept-language': 'en-US,en;q=0.9',
    origin: 'https://www.naukri.com',
    referer,
    systemid: '105',
    'x-http-method-override': 'PUT',
  }),
  jobApi: { appid: '121', clientid: 'd3skt0p', accept: 'application/json' },
} satisfies Record<string, Headers | ((...a: never[]) => Headers)>;

/** RSA key Naukri's frontend uses to sign the `nkparam` header. */
export const NKPARAM_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBALrlQ+djR0RjJwBF1xuisHmdFv334MIm
K6LgzJhmLhN7B5yuEyaKoasgXQk3+OQglsOaBxEJ0j5PcTL3nbOvt80CAwEAAQ==
-----END PUBLIC KEY-----`;

/** BotGuard SDK parameters for the login `vid` header. */
export const VID = {
  appId: '105',
  pageUrl: 'https://www.naukri.com/nlogin/login',
  publicKey:
    'MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBALbx2oNW1OsL+zv+GK4Ed70m4gr6sBjpzj1PCmLAYs3dQph0IS/DFWXMDN//CyC46DgSJZJZdaxT0xskFBIKNSMCAwEAAQ==',
};

export const APPLY_SOURCES = {
  recommended: { applySrc: 'drecomm_apply', logstr: (sid: string) => `--drecomm_apply-1-F-0-1--${sid}-` },
  search: { applySrc: 'srp', logstr: (sid: string) => `--srp-1-F-0-1--${sid}-` },
} as const;
