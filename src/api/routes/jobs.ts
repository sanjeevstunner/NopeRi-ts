import { Router } from 'express';
import { z } from 'zod';
import type { NaukriJobs } from '../../naukri/jobs.ts';

const Search = z.object({
  keyword: z.string().trim().min(1),
  location: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional(),
  jobAge: z.coerce.number().int().min(1).optional(),
  experience: z.coerce.number().int().min(0).max(50).optional(),
  resultsPerPage: z.coerce.number().int().min(1).max(100).optional(),
  latLong: z.string().optional(),
});

const JobId = z.string().regex(/^\d+$/, 'jobId must be numeric');
const Sid = z.object({ sid: z.string().regex(/^\d+$/).optional() });

const Apply = z.object({
  mandatorySkills: z.array(z.string()).optional(),
  optionalSkills: z.array(z.string()).optional(),
  sid: z.string().regex(/^\d+$/).optional(),
  source: z.enum(['recommended', 'search']).optional(),
  answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(),
});

export function jobRoutes(jobs: NaukriJobs) {
  return Router()
    .get('/jobs/recommended', async (_req, res) => {
      res.json(await jobs.recommended());
    })
    .get('/jobs/search', async (req, res) => {
      res.json(await jobs.search(Search.parse(req.query)));
    })
    .get('/jobs/:jobId', async (req, res) => {
      res.json(await jobs.details(JobId.parse(req.params.jobId), Sid.parse(req.query).sid));
    })
    .post('/jobs/:jobId/apply', async (req, res) => {
      const jobId = JobId.parse(req.params.jobId);
      res.json(await jobs.apply({ jobId, ...Apply.parse(req.body ?? {}) }));
    });
}
