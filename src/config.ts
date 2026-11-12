import { z } from 'zod';

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
  if (!(e.NAUKRI_USERNAME && e.NAUKRI_PASSWORD) && !(e.NAUKRIGULF_USERNAME && e.NAUKRIGULF_PASSWORD))
    throw new Error('Invalid configuration (check .env):\nSet NAUKRI_USERNAME/NAUKRI_PASSWORD and/or NAUKRIGULF_USERNAME/NAUKRIGULF_PASSWORD');
  return {
    port: e.PORT,
    apiKey: e.API_KEY,
    // Each service is enabled only when both its credentials are set.
    naukri:
      e.NAUKRI_USERNAME && e.NAUKRI_PASSWORD
        ? { username: e.NAUKRI_USERNAME, password: e.NAUKRI_PASSWORD, proxy: e.NAUKRI_PROXY }
        : undefined,
    gulf:
      e.NAUKRIGULF_USERNAME && e.NAUKRIGULF_PASSWORD
        ? { username: e.NAUKRIGULF_USERNAME, password: e.NAUKRIGULF_PASSWORD, proxy: e.NAUKRI_PROXY }
        : undefined,
  };
}

export type Config = ReturnType<typeof loadConfig>;
