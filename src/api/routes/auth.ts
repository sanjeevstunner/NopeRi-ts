import { Router } from 'express';
import { z } from 'zod';
import type { NaukriAuth } from '../../naukri/auth.ts';

const OtpTarget = z.object({
  username: z.string().min(1).optional(),
  isMobile: z.boolean().default(true),
});
const VerifyOtp = OtpTarget.extend({ otp: z.string().regex(/^\d{4,8}$/, 'OTP must be 4-8 digits') });

export function authRoutes(auth: NaukriAuth) {
  return Router()
    .get('/auth/status', (_req, res) => {
      res.json(auth.status);
    })
    .post('/auth/login', async (_req, res) => {
      await auth.login();
      res.json(auth.status);
    })
    .post('/auth/otp/send', async (req, res) => {
      const { username, isMobile } = OtpTarget.parse(req.body ?? {});
      res.json(await auth.sendOtp(username, isMobile));
    })
    .post('/auth/otp/verify', async (req, res) => {
      const { otp, username, isMobile } = VerifyOtp.parse(req.body);
      await auth.verifyOtp(otp, username, isMobile);
      res.json(auth.status);
    });
}
