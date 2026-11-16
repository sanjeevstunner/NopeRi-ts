import { Router } from 'express';
import type { NaukriClient } from '../../naukri/index.ts';
import { authRoutes } from './auth.ts';
import { jobRoutes, Search } from './jobs.ts';
import { ProfileUpdate, profileRoutes } from './profile.ts';
import { siteRoutes } from './site.ts';

export type NaukriServices = Pick<NaukriClient, 'auth' | 'profile' | 'jobs'>;

/** Naukri routes, mounted under /api: the shared site routes plus Naukri's own. */
export function naukriRoutes(naukri: NaukriServices) {
  return Router()
    .use(siteRoutes(naukri, { search: Search, profileUpdate: ProfileUpdate }))
    .use(authRoutes(naukri.auth), profileRoutes(naukri.profile), jobRoutes(naukri.jobs, naukri.profile));
}
