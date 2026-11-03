import express, { Router } from 'express';
import { z } from 'zod';
import type { NaukriProfile } from '../../naukri/profile.ts';

const ProfileUpdate = z
  .object({
    headline: z.string().trim().min(1).max(250),
    name: z.string().trim().min(1).max(100),
    summary: z.string().trim().min(1).max(1000),
  })
  .partial()
  .refine((f) => Object.values(f).some((v) => v !== undefined), 'Provide at least one of headline, name, summary');

const ResumeUpload = z.object({
  body: z.instanceof(Buffer, { message: 'Send the PDF as the raw body with Content-Type: application/pdf' }).refine(
    (b) => b.subarray(0, 5).toString() === '%PDF-',
    'Body is not a PDF',
  ),
  filename: z
    .string()
    .regex(/^[\w.\- ]+\.pdf$/i, 'filename must end in .pdf and contain no path characters')
    .default('resume.pdf'),
});

const History = z.object({
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  days: z.coerce.number().int().min(1).max(365).optional(),
  pageNumber: z.coerce.number().int().min(1).optional(),
  mobile: z.stringbool().optional(),
});

export function profileRoutes(profile: NaukriProfile) {
  return Router()
    .get('/profile/id', async (_req, res) => {
      res.json({ profileId: await profile.profileId() });
    })
    .patch('/profile', async (req, res) => {
      res.json(await profile.update(ProfileUpdate.parse(req.body)));
    })
    .put('/profile/resume', express.raw({ type: 'application/pdf', limit: '5mb' }), async (req, res) => {
      const { body, filename } = ResumeUpload.parse({ body: req.body, filename: req.query.filename });
      res.json(await profile.uploadResume(body, filename));
    })
    .get('/applications', async (req, res) => {
      res.json(await profile.applicationHistory(History.parse(req.query)));
    });
}
