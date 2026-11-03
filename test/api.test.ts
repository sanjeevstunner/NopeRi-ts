import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { createApp, type Services } from '../src/api/app.ts';
import { NaukriAuthError } from '../src/naukri/errors.ts';

const KEY = 'test-key-0123456789';
const calls: unknown[] = [];

// Stubbed services: tests the HTTP contract (auth, validation, error mapping) without hitting Naukri.
const services = {
  auth: { status: { loggedIn: true, loginTime: null } },
  profile: {
    update: async (f: unknown) => (calls.push(f), { profileId: 'p1', response: {} }),
    uploadResume: async (b: Buffer, name: string) => (calls.push([b.length, name]), { profileId: 'p1', response: {} }),
  },
  jobs: {
    search: async (p: unknown) => (calls.push(p), []),
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
  const res = await call('/api/jobs/search');
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'VALIDATION_ERROR');
});

test('profile update needs at least one field', async () => {
  assert.equal((await call('/api/profile', { method: 'PATCH', body: '{}' })).status, 400);
  assert.equal((await call('/api/profile', { method: 'PATCH', body: '{"headline":"Backend"}' })).status, 200);
});

test('resume upload accepts raw PDF only', async () => {
  const pdf = Buffer.from('%PDF-1.4 fake');
  const ok = await call('/api/profile/resume?filename=cv.pdf', {
    method: 'PUT',
    body: pdf,
    headers: { 'content-type': 'application/pdf' },
  });
  assert.equal(ok.status, 200);
  assert.deepEqual(calls.at(-1), [pdf.length, 'cv.pdf']);
  const bad = await call('/api/profile/resume', { method: 'PUT', body: 'hello', headers: { 'content-type': 'text/plain' } });
  assert.equal(bad.status, 400);
});

test('Naukri errors map to typed JSON errors', async () => {
  const res = await call('/api/jobs/123/apply', { method: 'POST', body: '{}' });
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error.code, 'NAUKRI_AUTH');
  assert.equal((await call('/api/jobs/abc/apply', { method: 'POST', body: '{}' })).status, 400);
  assert.equal((await call('/api/nope')).status, 404);
});
