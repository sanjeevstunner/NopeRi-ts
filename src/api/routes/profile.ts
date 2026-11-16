import { Router } from 'express';
import { z } from 'zod';
import type { NaukriProfile } from '../../naukri/profile.ts';
import { ResumeFile, resumeUpload } from '../upload.ts';
import { NOTICE_PERIODS } from '../../naukri/constants.ts';
import { JobId, profileUpdateSchema } from './site.ts';

const Tag = z.object({ id: z.number().int().positive(), name: z.string().trim().min(1) });

/** Naukri's editable fields: headline/name/summary plus key skills and the career profile. At least one is required. */
export const ProfileUpdate = profileUpdateSchema(['headline', 'name', 'summary'], {
  keySkills: z.array(z.string().trim().min(1).max(100)).min(1).max(50),
  desiredRoles: z.array(Tag).min(1).max(3),
  preferredLocations: z.array(Tag).min(1).max(10),
  expectedSalary: z.object({ amount: z.number().int().positive(), currency: z.string().length(3).default('INR') }),
  noticePeriodId: z.number().int().refine((id) => id in NOTICE_PERIODS, 'unknown notice period'),
});

const Lookup = z.object({ type: z.enum(['location', 'designation']), q: z.string().trim().min(2).max(100) });

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
    .get('/profile/editable', async (_req, res) => {
      res.json(await profile.editable());
    })
    .get('/profile/lookup', async (req, res) => {
      const { type, q } = Lookup.parse(req.query);
      res.json(await profile.lookup(type, q));
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
