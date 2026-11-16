import { createClient, type ClientOptions } from '../common/client.ts';
import { GulfAuth } from './auth.ts';
import { GulfJobs } from './jobs.ts';
import { GulfProfile } from './profile.ts';

export const createGulfClient = (options: ClientOptions) => createClient(options, GulfAuth, GulfProfile, GulfJobs);

export type GulfClient = ReturnType<typeof createGulfClient>;
