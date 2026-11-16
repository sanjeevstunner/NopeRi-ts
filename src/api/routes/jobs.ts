import { Router } from 'express';
import { z } from 'zod';
import { FILTER_PARAMS } from '../../naukri/constants.ts';
import type { NaukriJobs } from '../../naukri/jobs.ts';
import type { NaukriProfile } from '../../naukri/profile.ts';
import { applyUpload, ResumeFile } from '../upload.ts';
import { JobId, searchSchema } from './site.ts';

export const Search = searchSchema(FILTER_PARAMS).extend({
  jobAge: z.coerce.number().int().min(1).optional(),
  latLong: z.string().optional(),
});

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

/** Naukri-only job routes. Recommended and search are in siteRoutes. */
export function jobRoutes(jobs: NaukriJobs, profile: NaukriProfile) {
  return Router()
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
