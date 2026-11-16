import express, { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { errorHandler, notFound, requireApiKey } from './middleware.ts';
import { openApiSpec } from './openapi.ts';
import { gulfRoutes, type GulfServices } from './routes/gulf.ts';
import { naukriRoutes, type NaukriServices } from './routes/naukri.ts';

export type Services = NaukriServices;

export function createApp(naukri: Services | undefined, apiKey: string, gulf?: GulfServices) {
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
    .use('/api', requireApiKey(apiKey), ...(naukri ? [naukriRoutes(naukri)] : []), ...(gulf ? [Router().use('/gulf', gulfRoutes(gulf))] : []))
    .use(notFound)
    .use(errorHandler);
}
