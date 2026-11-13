import { Router } from 'express';
import { z } from 'zod';
import { FILTER_PARAMS } from '../../naukri/constants.ts';
import type { NaukriJobs } from '../../naukri/jobs.ts';
import type { NaukriProfile } from '../../naukri/profile.ts';
import { applyUpload, ResumeFile } from './profile.ts';

const Search = z.object({
  keyword: z.string().trim().min(1),
  location: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional(),
  jobAge: z.coerce.number().int().min(1).optional(),
  experience: z.coerce.number().int().min(0).max(50).optional(),
  resultsPerPage: z.coerce.number().int().min(1).max(100).optional(),
  latLong: z.string().optional(),
  filters: z
    .record(z.string().refine((k) => k in FILTER_PARAMS, 'unknown filter'), z.array(z.string().regex(/^[\w-]+$/)))
    .optional(),
});

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

const JobId = z.string().regex(/^\d+$/, 'jobId must be numeric');
const Sid = z.object({ sid: z.string().regex(/^\d+$/).optional() });

const Apply = z.object({
  mandatorySkills: z.array(z.string()).optional(),
  optionalSkills: z.array(z.string()).optional(),
  sid: z.string().regex(/^\d+$/).optional(),
  source: z.enum(['recommended', 'search']).optional(),
  answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(),
});

const ApplyData = z.string().transform((s, ctx) => {
  try {
    return JSON.parse(s);
  } catch {
    ctx.addIssue({ code: 'custom', message: '"data" must be the apply body as a JSON string' });
    return z.NEVER;
  }
});

export function jobRoutes(jobs: NaukriJobs, profile: NaukriProfile) {
  return Router()
    .get('/jobs/recommended', async (_req, res) => {
      res.json(await jobs.recommended());
    })
    .get('/jobs/search', async (req, res) => {
      res.json(await jobs.search(Search.parse(searchQuery(req.query))));
    })
    .get('/jobs/:jobId', async (req, res) => {
      res.json(await jobs.details(JobId.parse(req.params.jobId), Sid.parse(req.query).sid));
    })
    // JSON body, or multipart with a `resume` PDF + `data` JSON: the resume is swapped in for this apply only.
    .post('/jobs/:jobId/apply', applyUpload, async (req, res) => {
      const jobId = JobId.parse(req.params.jobId);
      const body = typeof req.body?.data === 'string' ? ApplyData.parse(req.body.data) : (req.body ?? {});
      const params = { jobId, ...Apply.parse(body) };
      if (!req.file) return void res.json(await jobs.apply(params));
      const { buffer, originalname } = ResumeFile.parse(req.file);
      res.json(await profile.withResume(buffer, originalname, () => jobs.apply(params)));
    });
}
