/** Base error for anything that goes wrong talking to Naukri. `status` is the HTTP status to surface to callers. */
export class NaukriError extends Error {
  readonly status: number;
  readonly code: string;
  readonly upstreamStatus?: number;
  readonly detail?: string;

  constructor(message: string, opts: { status: number; code: string; upstreamStatus?: number; detail?: string }) {
    super(message);
    this.name = new.target.name;
    this.status = opts.status;
    this.code = opts.code;
    this.upstreamStatus = opts.upstreamStatus;
    this.detail = opts.detail?.slice(0, 500);
  }
}

/** Login, OTP, expired token, or Naukri rejecting the request (401/403). */
export class NaukriAuthError extends NaukriError {
  constructor(message: string, upstreamStatus?: number, detail?: string) {
    super(message, { status: 401, code: 'NAUKRI_AUTH', upstreamStatus, detail });
  }
}

/** Naukri returned an error or a response we could not understand. */
export class NaukriUpstreamError extends NaukriError {
  constructor(message: string, upstreamStatus?: number, detail?: string) {
    super(message, { status: 502, code: 'NAUKRI_UPSTREAM', upstreamStatus, detail });
  }
}
