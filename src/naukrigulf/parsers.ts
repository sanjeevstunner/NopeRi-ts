import type { Job } from '../naukri/types.ts';

/** Maps one `Jobs[].Job` entry of NaukriGulf's search/recommendation responses to the shared Job shape. */
export function parseJob(entry: any): Job {
  const j = entry?.Job ?? entry ?? {};
  const { Min, Max } = j.Experience ?? {};
  const posted = Number(j.LatestPostedDate);
  return {
    jobId: String(j.JobId ?? ''),
    title: j.Designation ?? '',
    company: j.Company?.Name?.trim() ?? '',
    location: j.Location ?? '',
    experience: Min != null && Max != null ? `${Min}-${Max} Yrs` : '',
    salary: '', // not in NaukriGulf list responses
    postedDate: posted ? new Date(posted * 1000).toISOString() : '',
    applyLink: j.JdURL ?? '',
    description: j.jobInfo ?? '',
    tags: String(j.keywords ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  };
}
