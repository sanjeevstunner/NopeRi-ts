import { Router } from 'express';
import { z } from 'zod';
import { FILTER_PARAMS } from '../../naukrigulf/constants.ts';
import type { GulfClient } from '../../naukrigulf/index.ts';
import { JobId, profileUpdateSchema, searchSchema, siteRoutes } from './site.ts';

const Search = searchSchema(FILTER_PARAMS);
const ProfileUpdate = profileUpdateSchema(['headline', 'summary']);
const Apply = z.object({ xz: z.string().optional(), source: z.string().regex(/^\w+$/).optional() }).default({});
const History = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  type: z.enum(['easy', 'web']).optional(),
});
const Section = z.string().regex(/^\w+$/, 'invalid section name');

export type GulfServices = Pick<GulfClient, 'auth' | 'jobs' | 'profile'>;

/** NaukriGulf routes, mounted under /api/gulf: the shared site routes plus NaukriGulf's own. */
export function gulfRoutes(gulf: GulfServices) {
  const { jobs, profile } = gulf;
  return Router()
    .use(siteRoutes(gulf, { search: Search, profileUpdate: ProfileUpdate }))
    .get('/applications', async (req, res) => void res.json(await profile.applications(History.parse(req.query))))
    .get('/profile/sections/:section', async (req, res) => void res.json(await profile.section(Section.parse(req.params.section))))
    .post('/jobs/:jobId/apply', async (req, res) => {
      res.json(await jobs.apply({ jobId: JobId.parse(req.params.jobId), ...Apply.parse(req.body) }));
    })
    .get('/jobs/:jobId', async (req, res) => void res.json(await jobs.details(JobId.parse(req.params.jobId))));
}
