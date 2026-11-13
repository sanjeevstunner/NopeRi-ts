import type { Cluster, Job } from '../naukri/types.ts';
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

/** Keeps only the filter groups we can send back, as `{id,count,label}` lists. */
export function pickClusters(raw: unknown): Record<string, Cluster[]> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, Cluster[]> = {};
  for (const [key, list] of Object.entries(raw)) {
    if (!(key in FILTER_PARAMS) || !Array.isArray(list) || !list.length) continue;
    out[key] = list.map((c) => ({ id: String(c.value), count: Number(c.count) || 0, label: String(c.label ?? '') }));
  }
  return out;
}
