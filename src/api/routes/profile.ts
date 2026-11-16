import { Router } from 'express';
import { z } from 'zod';
import type { NaukriProfile } from '../../naukri/profile.ts';
import { ResumeFile, resumeUpload } from '../upload.ts';
import { JobId, profileUpdateSchema } from './site.ts';

export const ProfileUpdate = profileUpdateSchema('headline', 'name', 'summary');

const History = z.object({
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  days: z.coerce.number().int().min(1).max(365).optional(),
  pageNumber: z.coerce.number().int().min(1).optional(),
  mobile: z.stringbool().optional(),
});

/** Naukri-only profile routes. Read/update/download are in siteRoutes. */
export function profileRoutes(profile: NaukriProfile) {
  return Router()
    .get('/profile/id', async (_req, res) => {
      res.json({ profileId: await profile.profileId() });
    })
    .put('/profile/resume', resumeUpload, async (req, res) => {
      const { buffer, originalname } = ResumeFile.parse(req.file);
      res.json(await profile.uploadResume(buffer, originalname));
    })
    .get('/applications', async (req, res) => {
      res.json(await profile.applicationHistory(History.parse(req.query)));
    })
    .get('/applications/:jobId', async (req, res) => {
      const jobId = JobId.parse(req.params.jobId);
      const { applyType } = z.object({ applyType: z.string().min(1).optional() }).parse(req.query);
      res.json(await profile.applicationDetail(jobId, applyType));
    });
}
