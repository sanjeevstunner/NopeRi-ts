import { Router } from 'express';
import { z } from 'zod';
import type { Job, Resume } from '../../common/types.ts';

// What the shared routes need from a site: small interfaces, so routes depend on behaviour, not on a site's classes.
export interface SiteAuth {
  readonly status: { loggedIn: boolean; loginTime: string | null };
  login(): Promise<void>;
  useToken(token: string): void;
}
export interface SiteProfile<U> {
  full(): Promise<unknown>;
  update(fields: U): Promise<unknown>;
  currentResume(): Promise<Resume>;
}
export interface SiteJobs<S> {
  recommended(): Promise<Job[]>;
  search(params: S): Promise<unknown>;
}
export interface SiteServices<S, U> {
  auth: SiteAuth;
  profile: SiteProfile<U>;
  jobs: SiteJobs<S>;
}

export const JobId = z.string().regex(/^\d+$/, 'jobId must be numeric');
const UseToken = z.object({ token: z.string().min(20) });

/** Search fields every site takes; `filterParams` is the site's cluster key → query param map. */
export const searchSchema = (filterParams: Record<string, string>) =>
  z.object({
    keyword: z.string().trim().min(1),
    location: z.string().trim().optional(),
    page: z.coerce.number().int().min(1).optional(),
    experience: z.coerce.number().int().min(0).max(50).optional(),
    resultsPerPage: z.coerce.number().int().min(1).max(100).optional(),
    filters: z
      .record(z.string().refine((k) => k in filterParams, 'unknown filter'), z.array(z.string().regex(/^[\w.-]+$/)))
      .optional(),
  });

const PROFILE_FIELDS = {
  headline: z.string().trim().min(1).max(250),
  name: z.string().trim().min(1).max(100),
  summary: z.string().trim().min(1).max(1000),
};

/** PATCH /profile body for the fields a site can edit; at least one is required. */
export const profileUpdateSchema = <K extends keyof typeof PROFILE_FIELDS>(...keys: K[]) =>
  z
    .object(Object.fromEntries(keys.map((k) => [k, PROFILE_FIELDS[k]])) as Pick<typeof PROFILE_FIELDS, K>)
    .partial()
    .refine((f) => Object.values(f).some((v) => v !== undefined), `Provide at least one of ${keys.join(', ')}`);

/** `filter.wfhType=2&filter.wfhType=3` → `{ filters: { wfhType: ['2','3'] } }`; other params pass through. */
export function searchQuery(query: Record<string, unknown>) {
  const filters: Record<string, string[]> = {};
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(query)) {
    if (key.startsWith('filter.')) filters[key.slice(7)] = ([] as unknown[]).concat(value).map(String);
    else rest[key] = value;
  }
  return Object.keys(filters).length ? { ...rest, filters } : rest;
}

/**
 * Routes every site serves the same way: auth status/login/token, profile read/update/resume,
 * recommended jobs and search. Mount before the site's own routes so `/jobs/recommended` and
 * `/jobs/search` win over `/jobs/:jobId`.
 */
export function siteRoutes<S, U>(
  { auth, profile, jobs }: SiteServices<S, U>,
  schemas: { search: z.ZodType<S>; profileUpdate: z.ZodType<U> },
) {
  return Router()
    .get('/auth/status', (_req, res) => void res.json(auth.status))
    .post('/auth/login', async (_req, res) => {
      await auth.login();
      res.json(auth.status);
    })
    .post('/auth/token', (req, res) => {
      auth.useToken(UseToken.parse(req.body).token);
      res.json(auth.status);
    })
    .get('/profile', async (_req, res) => void res.json(await profile.full()))
    .patch('/profile', async (req, res) => void res.json(await profile.update(schemas.profileUpdate.parse(req.body))))
    .get('/profile/resume', async (_req, res) => {
      const { file, filename } = await profile.currentResume();
      res.type('application/pdf').attachment(filename).send(file);
    })
    .get('/jobs/recommended', async (_req, res) => void res.json(await jobs.recommended()))
    .get('/jobs/search', async (req, res) => void res.json(await jobs.search(schemas.search.parse(searchQuery(req.query)))));
}
