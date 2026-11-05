import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { createApp, type Services } from '../src/api/app.ts';
import { NaukriAuthError } from '../src/naukri/errors.ts';
import { NaukriProfile } from '../src/naukri/profile.ts';

const KEY = 'test-key-0123456789';
const calls: unknown[] = [];

// Stubbed services: tests the HTTP contract (auth, validation, error mapping) without hitting Naukri.
const services = {
  auth: { status: { loggedIn: true, loginTime: null } },
  profile: {
    full: async () => ({ profile: [{ profileId: 'p1' }] }),
    update: async (f: unknown) => (calls.push(f), { profileId: 'p1', response: {} }),
    uploadResume: async (b: Buffer, name: string) => (calls.push([b.length, name]), { profileId: 'p1', response: {} }),
  },
  jobs: {
    search: async (p: unknown) => (calls.push(p), { jobs: [], total: 0, clusters: {}, clusterOrder: [] }),
    apply: async () => {
      throw new NaukriAuthError('token expired', 401);
    },
  },
} as unknown as Services;

let base = '';
let server: ReturnType<ReturnType<typeof createApp>['listen']>;
before(() => {
  server = createApp(services, KEY).listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());

const call = (path: string, init: RequestInit = {}, key = KEY) =>
  fetch(base + path, { ...init, headers: { 'x-api-key': key, 'content-type': 'application/json', ...init.headers } });

test('health is public, /api requires the key', async () => {
  assert.equal((await fetch(`${base}/health`)).status, 200);
  assert.equal((await call('/api/auth/status', {}, 'wrong')).status, 401);
  assert.equal((await call('/api/auth/status')).status, 200);
});

test('search coerces query params and rejects missing keyword', async () => {
  assert.equal((await call('/api/jobs/search?keyword=node&page=2&experience=3')).status, 200);
  assert.deepEqual(calls.at(-1), { keyword: 'node', page: 2, experience: 3 });
  assert.equal((await call('/api/jobs/search?keyword=node&filter.wfhType=2&filter.wfhType=3&filter.citiesGid=97')).status, 200);
  assert.deepEqual(calls.at(-1), { keyword: 'node', filters: { wfhType: ['2', '3'], citiesGid: ['97'] } });
  assert.equal((await call('/api/jobs/search?keyword=node&filter.bogus=1')).status, 400);
  const res = await call('/api/jobs/search');
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'VALIDATION_ERROR');
});

test('profile update needs at least one field', async () => {
  assert.deepEqual(await (await call('/api/profile')).json(), { profile: [{ profileId: 'p1' }] });
  assert.equal((await call('/api/profile', { method: 'PATCH', body: '{}' })).status, 400);
  assert.equal((await call('/api/profile', { method: 'PATCH', body: '{"headline":"Backend"}' })).status, 200);
});

test('resume upload takes a multipart PDF in the "resume" field', async () => {
  // No content-type header: fetch sets the multipart boundary itself.
  const upload = (field: string, content: Uint8Array<ArrayBuffer> | string, name: string) => {
    const form = new FormData();
    form.append(field, new Blob([content]), name);
    return fetch(`${base}/api/profile/resume`, { method: 'PUT', body: form, headers: { 'x-api-key': KEY } });
  };
  const pdf = new TextEncoder().encode("%PDF-1.4 fake");

  assert.equal((await upload('resume', pdf, '../My CV (1).pdf')).status, 200);
  assert.deepEqual(calls.at(-1), [pdf.length, 'My CV (1).pdf']);
  assert.equal((await upload('resume', pdf, 'cv.docx')).status, 200);
  assert.deepEqual(calls.at(-1), [pdf.length, 'resume.pdf']);

  assert.equal((await upload('resume', 'hello', 'cv.pdf')).status, 400); // not a PDF
  assert.equal((await upload('file', pdf, 'cv.pdf')).status, 400); // wrong field
  assert.equal((await upload('resume', new Uint8Array(5 * 1024 * 1024 + 1), 'cv.pdf')).status, 413);
  assert.equal((await call('/api/profile/resume', { method: 'PUT', body: '{}' })).status, 400); // not multipart
});

test('Naukri errors map to typed JSON errors', async () => {
  const res = await call('/api/jobs/123/apply', { method: 'POST', body: '{}' });
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error.code, 'NAUKRI_AUTH');
  assert.equal((await call('/api/jobs/abc/apply', { method: 'POST', body: '{}' })).status, 400);
  assert.equal((await call('/api/nope')).status, 404);
});

test('apply with a resume swaps it in, then restores the original even when apply fails', async () => {
  // Real withResume (lock + finally); only the Naukri calls underneath are stubbed.
  const uploads: string[] = [];
  class StubProfile extends NaukriProfile {
    override currentResume = async () => ({ file: Buffer.from('%PDF-original'), filename: 'Original-v1.pdf' });
    override uploadResume = async (_b: Buffer, name = '') => (uploads.push(name), { profileId: 'p1', response: {} });
  }
  let applied: unknown;
  const jobs = {
    apply: async (p: { jobId: string }) => {
      applied = p;
      if (p.jobId === '2') throw new NaukriAuthError('token expired', 401);
      return { applied: true };
    },
  };
  const app = createApp({ ...services, profile: new StubProfile({} as any, {} as any), jobs } as unknown as Services, KEY);
  const srv = app.listen(0);
  const url = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  const apply = (jobId: string, data?: string) => {
    const form = new FormData();
    form.append('resume', new Blob([new TextEncoder().encode('%PDF-tailored')]), 'Tailored.pdf');
    if (data !== undefined) form.append('data', data);
    return fetch(`${url}/api/jobs/${jobId}/apply`, { method: 'POST', body: form, headers: { 'x-api-key': KEY } });
  };
  try {
    const ok = await apply('1', '{"sid":"42","mandatorySkills":["node"]}');
    assert.equal(ok.status, 200);
    assert.deepEqual(applied, { jobId: '1', sid: '42', mandatorySkills: ['node'] });
    assert.deepEqual(uploads, ['Tailored.pdf', 'Original-v1.pdf']);

    assert.equal((await apply('2')).status, 401);
    assert.deepEqual(uploads.slice(2), ['Tailored.pdf', 'Original-v1.pdf']); // restored despite the failure

    assert.equal((await apply('1', 'not json')).status, 400);
    assert.equal(uploads.length, 4); // bad input never touches the profile
  } finally {
    srv.close();
  }
});
