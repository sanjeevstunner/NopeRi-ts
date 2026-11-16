import { pickClusters as pickBy } from '../common/clusters.ts';
import type { Cluster, Job } from '../common/types.ts';
import { BASE, FILTER_PARAMS } from './constants.ts';

/**
 * Maps one job to the shared Job shape. Search entries are `{ Job: { JobId, Designation, ... } }` (PascalCase);
 * recommendation entries are flat camelCase (`jobId`, `designation`, relative `jdURL`).
 */
export function parseJob(entry: any): Job {
  const j = entry?.Job ?? entry ?? {};
  const exp = j.Experience ?? j.experience ?? {};
  const [min, max] = [exp.Min ?? exp.min, exp.Max ?? exp.max];
  const posted = Number(j.LatestPostedDate ?? j.latestPostedDate);
  const url = String(j.JdURL ?? j.jdURL ?? '');
  return {
    jobId: String(j.JobId ?? j.jobId ?? ''),
    title: j.Designation ?? j.designation ?? '',
    company: (j.Company?.Name ?? j.company?.name ?? '').trim(),
    location: j.Location ?? j.location ?? '',
    experience: min != null && max != null ? `${min}-${max} Yrs` : '',
    salary: '', // not in NaukriGulf list responses
    postedDate: posted ? new Date(posted * 1000).toISOString() : '',
    applyLink: !url || /^https?:/.test(url) ? url : `${BASE}/${url.replace(/^\//, '')}`,
    description: j.jobInfo ?? '',
    tags: String(j.keywords ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  };
}

/** NaukriGulf clusters carry their id in `value`. */
export const pickClusters = (raw: unknown): Record<string, Cluster[]> => pickBy(raw, FILTER_PARAMS, (c) => c.value);
