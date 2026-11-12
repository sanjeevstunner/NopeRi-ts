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
const Section = z.string().regex(/^\w+$/, 'invalid section name');
const ProfileUpdate = z
  .object({ headline: z.string().trim().min(1).max(250), summary: z.string().trim().min(1).max(1000) })
  .partial()
  .refine((f) => Object.values(f).some((v) => v !== undefined), 'Provide at least one of headline, summary');

/** NaukriGulf routes, mounted under /api/gulf. */
export function gulfRoutes({ auth, jobs, profile }: Pick<GulfClient, 'auth' | 'jobs' | 'profile'>) {
  return Router()
    .get('/auth/status', (_req, res) => void res.json(auth.status))
    .post('/auth/login', async (_req, res) => {
      await auth.login();
      res.json(auth.status);
    })
    .get('/profile', async (_req, res) => void res.json(await profile.full()))
    .patch('/profile', async (req, res) => void res.json(await profile.update(ProfileUpdate.parse(req.body))))
    .get('/profile/resume', async (_req, res) => {
      const { file, filename } = await profile.currentResume();
      res.type('application/pdf').attachment(filename).send(file);
    })
    .get('/profile/sections/:section', async (req, res) => void res.json(await profile.section(Section.parse(req.params.section))))
    .get('/jobs/recommended', async (_req, res) => void res.json(await jobs.recommended()))
    .get('/jobs/search', async (req, res) => void res.json(await jobs.search(Search.parse(req.query))))
    .get('/jobs/:jobId', async (req, res) => void res.json(await jobs.details(JobId.parse(req.params.jobId))));
}
