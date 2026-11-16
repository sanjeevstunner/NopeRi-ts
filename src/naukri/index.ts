import { createClient, type ClientOptions } from '../common/client.ts';
import { NaukriAuth } from './auth.ts';
import { NaukriJobs } from './jobs.ts';
import { NaukriProfile } from './profile.ts';

export const createNaukriClient = (options: ClientOptions) => createClient(options, NaukriAuth, NaukriProfile, NaukriJobs);

export type NaukriClient = ReturnType<typeof createNaukriClient>;

export { NaukriAuth, NaukriJobs, NaukriProfile };
export * from '../common/errors.ts';
export type * from './types.ts';
