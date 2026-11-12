import { Router } from 'express';
import { z } from 'zod';
import type { GulfClient } from '../../naukrigulf/index.ts';

const Search = z.object({
  keyword: z.string().trim().min(1),
  location: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional(),
  experience: z.coerce.number().int().min(0).max(50).optional(),
  resultsPerPage: z.coerce.number().int().min(1).max(100).optional(),
});
const JobId = z.string().regex(/^\d+$/, 'jobId must be numeric');
const Section = z.object({ section: z.string().regex(/^\w+$/).default('mnjWidget') });

/** NaukriGulf routes, mounted under /api/gulf. */
export function gulfRoutes({ auth, jobs }: Pick<GulfClient, 'auth' | 'jobs'>) {
  return Router()
    .get('/auth/status', (_req, res) => void res.json(auth.status))
    .post('/auth/login', async (_req, res) => {
      await auth.login();
      res.json(auth.status);
    })
    .get('/profile', async (req, res) => void res.json(await jobs.profile(Section.parse(req.query).section)))
    .get('/jobs/recommended', async (_req, res) => void res.json(await jobs.recommended()))
    .get('/jobs/search', async (req, res) => void res.json(await jobs.search(Search.parse(req.query))))
    .get('/jobs/:jobId', async (req, res) => void res.json(await jobs.details(JobId.parse(req.params.jobId))));
}
