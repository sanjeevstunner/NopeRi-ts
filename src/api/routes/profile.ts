import { basename } from 'node:path';
import { Router } from 'express';
import multer from 'multer';
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

const RESUME_FIELD = 'resume';
const MAX_RESUME_BYTES = 5 * 1024 * 1024;

// Memory storage: the file is forwarded to Naukri as-is, never written to disk.
const resumeUpload = multer({ limits: { fileSize: MAX_RESUME_BYTES, files: 1, fields: 0 } }).single(RESUME_FIELD);

const ResumeFile = z.object(
  {
    buffer: z.instanceof(Buffer).refine((b) => b.subarray(0, 5).toString() === '%PDF-', 'File is not a PDF'),
    // Keep the client's name (Naukri shows it) minus anything path-like or exotic.
    originalname: z
      .string()
      .transform((n) => basename(n).replace(/[^\w.\- ()]/g, '_'))
      .transform((n) => (/\.pdf$/i.test(n) ? n : 'resume.pdf')),
  },
  { message: `Send the PDF as multipart/form-data in a field named "${RESUME_FIELD}"` },
);

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
    .put('/profile/resume', resumeUpload, async (req, res) => {
      const { buffer, originalname } = ResumeFile.parse(req.file);
      res.json(await profile.uploadResume(buffer, originalname));
    })
    .get('/applications', async (req, res) => {
      res.json(await profile.applicationHistory(History.parse(req.query)));
    });
}
