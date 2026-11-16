import { Session, type Response } from 'httpcloak';
import { NaukriAuthError, NaukriQuotaError, NaukriUpstreamError } from './errors.ts';

/** The slice of an HTTP session the Naukri services depend on. Stub this in tests. */
export type Http = Pick<Session, 'get' | 'post' | 'getCookie' | 'setCookie' | 'close'>;

/**
 * Chrome-fingerprinted session (TLS + HTTP/2), which Naukri requires; plain fetch gets flagged.
 * Cookies persist on the session, so one instance is one logged-in Naukri user.
 */
export function createHttp(proxy?: string): Http {
  return new Session({
    preset: 'chrome-latest',
    timeout: 30,
    ...(proxy && { proxy }),
    // ponytail: session-wide retry also covers POSTs (apply, OTP); move to per-call retry if double submits show up
    retry: 4,
    retryOnStatus: [429, 500, 502, 503, 504],
    retryWaitMin: 1000,
    retryWaitMax: 30_000,
  });
}

function upstreamMessage(res: Response): string {
  try {
    return res.json<{ message?: string }>().message ?? res.reason;
  } catch {
    return res.reason;
  }
}

/** Naukri's "Daily quota of jobs exceeded" 403: a limit, not a rejected login. */
export function isQuota(body: string): boolean {
  return /"customErrorCode"\s*:\s*403009|daily quota/i.test(body);
}

/** Throws a typed error for non-2xx responses: quota → 429, 401/403 → auth, everything else → upstream. */
export function ensureOk(res: Response, what: string): Response {
  if (res.statusCode === 403 && isQuota(res.text)) {
    throw new NaukriQuotaError(`${what}: ${upstreamMessage(res)}`, res.statusCode, res.text);
  }
  if (res.statusCode === 401 || res.statusCode === 403) {
    throw new NaukriAuthError(`${what}: ${upstreamMessage(res)}`, res.statusCode, res.text);
  }
  if (!res.ok) throw new NaukriUpstreamError(`${what} failed`, res.statusCode, res.text);
  return res;
}

export function readJson<T = any>(res: Response, what: string): T {
  ensureOk(res, what);
  try {
    return res.json<T>();
  } catch {
    throw new NaukriUpstreamError(`${what}: invalid JSON response`, res.statusCode, res.text);
  }
}

/** Drops undefined/empty values so optional query params are omitted rather than sent as "". */
export function compact(params: Record<string, string | number | boolean | undefined>) {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')) as Record<
    string,
    string | number | boolean
  >;
}
