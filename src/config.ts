import { z } from 'zod';
import type { ClientOptions } from './common/client.ts';

const optional = <T extends z.ZodType>(schema: T) => z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  API_KEY: z.string().min(16, 'must be at least 16 characters'),
  NAUKRI_USERNAME: optional(z.string().min(1)),
  NAUKRI_PASSWORD: optional(z.string().min(1)),
  NAUKRI_PROXY: optional(z.url()),
  NAUKRIGULF_USERNAME: optional(z.string().min(1)),
  NAUKRIGULF_PASSWORD: optional(z.string().min(1)),
});

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) throw new Error(`Invalid configuration (check .env):\n${z.prettifyError(parsed.error)}`);
  const e = parsed.data;
  // Each site is enabled only when both its credentials are set. Both share the outbound proxy.
  const site = (username?: string, password?: string): ClientOptions | undefined =>
    username && password ? { username, password, proxy: e.NAUKRI_PROXY } : undefined;
  const naukri = site(e.NAUKRI_USERNAME, e.NAUKRI_PASSWORD);
  const gulf = site(e.NAUKRIGULF_USERNAME, e.NAUKRIGULF_PASSWORD);
  if (!naukri && !gulf)
    throw new Error('Invalid configuration (check .env):\nSet NAUKRI_USERNAME/NAUKRI_PASSWORD and/or NAUKRIGULF_USERNAME/NAUKRIGULF_PASSWORD');
  return { port: e.PORT, apiKey: e.API_KEY, naukri, gulf };
}

export type Config = ReturnType<typeof loadConfig>;
