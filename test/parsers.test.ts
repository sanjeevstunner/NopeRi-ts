import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  appJsUrl,
  buildSeoKey,
  extractFormKey,
  generateNkparam,
  mnjVersion,
  newSid,
  parseHistory,
  parseJob,
} from '../src/naukri/parsers.ts';

test('nkparam is a 512-bit RSA ciphertext in base64', () => {
  const token = generateNkparam('srp');
  assert.equal(Buffer.from(token, 'base64').length, 64);
  assert.notEqual(token, generateNkparam('srp')); // PKCS#1 v1.5 padding is randomised
});

test('sid is UTC timestamp plus 7 zeros', () => {
  assert.equal(newSid(new Date('2026-11-03T04:05:06.789Z')), '202611030405060000000');
});

test('seoKey slugs keyword and optional location', () => {
  assert.equal(buildSeoKey('Node.js Developer', 'Hyderabad', 1), 'node-dot-js-developer-jobs-in-hyderabad-1');
  assert.equal(buildSeoKey(' C++ ', '', 2), 'c-jobs-2');
  assert.equal(buildSeoKey('Data Engineer', 'New Delhi', 3), 'data-engineer-jobs-in-new-delhi-3');
});

test('parseJob maps fields and falls back sensibly', () => {
  const job = parseJob({
    jobId: 123,
    title: 'Backend Engineer',
    companyName: 'Acme',
    placeholders: [{ type: 'location', label: 'Pune' }],
    salaryDetail: { hideSalary: true },
    tagsAndSkills: 'node, aws ,docker',
  });
  assert.equal(parseJob({ jdURL: '/job-listings-x-1', placeholders: [{ type: 'salary', label: '5-8 Lacs' }] }).applyLink,
    'https://www.naukri.com/job-listings-x-1');
  assert.equal(parseJob({ placeholders: [{ type: 'salary', label: '5-8 Lacs' }] }).salary, '5-8 Lacs');
  assert.equal(job.jobId, '123');
  assert.equal(job.location, 'Pune');
  assert.deepEqual(job.tags, ['node', 'aws', 'docker']);
  assert.equal(job.salary, 'Not disclosed');
  assert.equal(job.applyLink, 'https://www.naukri.com/job-listings-123');
  assert.deepEqual(parseJob({}).tags, []);
});

test('parseHistory handles ratings and missing fields', () => {
  const [h] = parseHistory({
    applyDetails: [
      {
        jobId: '9',
        jobTitle: 'Dev',
        company: 'Acme',
        location: 'Pune',
        applyType: 'easy',
        isOpen: 'true',
        companyRating: { AggregateRating: '4.1' },
        status: [{ statusId: 1, statusValue: 'Applied', dateTime: 'x' }],
      },
    ],
  });
  assert.equal(h.isOpen, true);
  assert.equal(h.companyRating, 4.1);
  assert.equal(h.statuses[0].statusValue, 'Applied');
  assert.deepEqual(parseHistory({}), []);
});

test('formKey discovery helpers', () => {
  const html = '<script src="//static.naukimg.com/s/5/105/j/app_v470.min.js"></script>';
  assert.equal(appJsUrl(html), 'https://static.naukimg.com/s/5/105/j/app_v470.min.js');
  assert.equal(mnjVersion('var _c={app:"_v470",mnj:"_v323",x:1}'), '_v323');
  assert.equal(extractFormKey('{key:"initUploader",value:function(){var d="F51f8e7e54e205"}}'), 'F51f8e7e54e205');
  assert.equal(extractFormKey('nothing here'), undefined);
});
