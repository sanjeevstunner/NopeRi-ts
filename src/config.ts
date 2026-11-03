import { z } from 'zod';

const optional = <T extends z.ZodType>(schema: T) => z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  API_KEY: z.string().min(16, 'must be at least 16 characters'),
  NAUKRI_USERNAME: z.string().min(1),
  NAUKRI_PASSWORD: z.string().min(1),
  NAUKRI_PROXY: optional(z.url()),
});

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) throw new Error(`Invalid configuration (check .env):\n${z.prettifyError(parsed.error)}`);
  const e = parsed.data;
  return {
    port: e.PORT,
    apiKey: e.API_KEY,
    naukri: { username: e.NAUKRI_USERNAME, password: e.NAUKRI_PASSWORD, proxy: e.NAUKRI_PROXY },
  };
}

export type Config = ReturnType<typeof loadConfig>;
