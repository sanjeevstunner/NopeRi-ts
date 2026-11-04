import express from 'express';
import swaggerUi from 'swagger-ui-express';
import type { NaukriClient } from '../naukri/index.ts';
import { errorHandler, notFound, requireApiKey } from './middleware.ts';
import { openApiSpec } from './openapi.ts';
import { authRoutes } from './routes/auth.ts';
import { jobRoutes } from './routes/jobs.ts';
import { profileRoutes } from './routes/profile.ts';

export type Services = Pick<NaukriClient, 'auth' | 'profile' | 'jobs'>;

export function createApp({ auth, profile, jobs }: Services, apiKey: string) {
  return express()
    .disable('x-powered-by')
    .use(express.json({ limit: '100kb' }))
    .get('/health', (_req, res) => {
      res.json({ ok: true });
    })
    // Documentation is public, like /health; the /api routes are what the key protects.
    .get('/openapi.json', (_req, res) => {
      res.json(openApiSpec);
    })
    .use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, { customSiteTitle: 'NopeRi API' }))
    .use('/api', requireApiKey(apiKey), authRoutes(auth), profileRoutes(profile), jobRoutes(jobs))
    .use(notFound)
    .use(errorHandler);
}
