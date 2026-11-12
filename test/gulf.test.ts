import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseJob } from '../src/naukrigulf/parsers.ts';

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
