import { basename } from 'node:path';
import multer from 'multer';
import { z } from 'zod';
import { isPdf } from '../common/pdf.ts';

export const RESUME_FIELD = 'resume';
const MAX_RESUME_BYTES = 5 * 1024 * 1024;

// Memory storage: the file is forwarded upstream as-is, never written to disk.
const upload = (fields: number) => multer({ limits: { fileSize: MAX_RESUME_BYTES, files: 1, fields } }).single(RESUME_FIELD);
/** Just the resume. */
export const resumeUpload = upload(0);
/** Apply takes the resume plus one `data` field holding the JSON apply body. */
export const applyUpload = upload(1);

export const ResumeFile = z.object(
  {
    buffer: z.instanceof(Buffer).refine(isPdf, 'File is not a PDF'),
    // Keep the client's name (the site shows it) minus anything path-like or exotic.
    originalname: z
      .string()
      .transform((n) => basename(n).replace(/[^\w.\- ()]/g, '_'))
      .transform((n) => (/\.pdf$/i.test(n) ? n : 'resume.pdf')),
  },
  { message: `Send the PDF as multipart/form-data in a field named "${RESUME_FIELD}"` },
);
