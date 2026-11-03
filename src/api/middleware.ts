import { createHash, timingSafeEqual } from 'node:crypto';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { HTTPCloakError } from 'httpcloak';
import { ZodError } from 'zod';
import { NaukriError } from '../naukri/errors.ts';

const digest = (s: string) => createHash('sha256').update(s).digest();

/** Requires `x-api-key` (or `Authorization: Bearer <key>`) to match the configured key. */
export function requireApiKey(apiKey: string): RequestHandler {
  const expected = digest(apiKey);
  return (req, res, next) => {
    const given = req.get('x-api-key') ?? req.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    if (timingSafeEqual(digest(given), expected)) return next();
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid API key' } });
  };
}

export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` } });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
    return;
  }
  if (err instanceof NaukriError) {
    console.warn(`${req.method} ${req.path} → ${err.name}: ${err.message} (upstream ${err.upstreamStatus ?? '-'})`);
    res.status(err.status).json({
      error: { code: err.code, message: err.message, upstreamStatus: err.upstreamStatus, detail: err.detail },
    });
    return;
  }
  if (err instanceof HTTPCloakError) {
    console.warn(`${req.method} ${req.path} → network error: ${err.message}`);
    res.status(502).json({ error: { code: 'NAUKRI_UNREACHABLE', message: 'Could not reach Naukri', detail: err.message } });
    return;
  }
  // Body-parser errors (malformed JSON, payload too large) carry a safe status + message.
  if (err?.expose && typeof err.status === 'number') {
    res.status(err.status).json({ error: { code: 'BAD_REQUEST', message: err.message } });
    return;
  }
  console.error(`${req.method} ${req.path} failed:`, err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal server error' } });
};
