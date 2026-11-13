import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseJob, pickClusters } from '../src/naukrigulf/parsers.ts';

test('parseJob maps a NaukriGulf search entry', () => {
  const job = parseJob({
    Job: {
      JobId: '181026000451',
      Designation: 'Full-Stack Software Engineer',
      Company: { Name: 'OG LLC ', Id: '1' },
      Location: 'Dubai',
      Experience: { Min: '3', Max: '7' },
      LatestPostedDate: '1792296000',
      JdURL: 'https://www.naukrigulf.com/x-jid-181026000451',
      keywords: 'Python, Docker',
    },
  });
  assert.equal(job.company, 'OG LLC');
  assert.equal(job.experience, '3-7 Yrs');
  assert.deepEqual(job.tags, ['Python', 'Docker']);
  assert.match(job.postedDate, /^2026-/);
});

test('parseJob maps a NaukriGulf recommendation entry', () => {
  const job = parseJob({
    jobId: '041126502315',
    designation: 'Senior Engineer',
    company: { name: 'Cinergie Digital' },
    location: 'Dubai - United Arab Emirates',
    experience: { min: '0', max: '5' },
    latestPostedDate: '1793768400',
    jdURL: 'senior-engineer-jobs-in-dubai-uae-41126502315',
    keywords: 'Java',
  });
  assert.equal(job.jobId, '041126502315');
  assert.equal(job.company, 'Cinergie Digital');
  assert.equal(job.experience, '0-5 Yrs');
  assert.equal(job.applyLink, 'https://www.naukrigulf.com/senior-engineer-jobs-in-dubai-uae-41126502315');
});

test('pickClusters keeps only filterable groups', () => {
  const clusters = pickClusters({
    country: [{ label: 'UAE', value: '17', count: '270' }],
    titles: [{ label: 'X', value: '1', count: '1' }],
  });
  assert.deepEqual(clusters, { country: [{ id: '17', count: 270, label: 'UAE' }] });
});
