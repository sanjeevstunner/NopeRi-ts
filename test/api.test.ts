import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { createApp, type Services } from '../src/api/app.ts';
import { NaukriAuthError } from '../src/common/errors.ts';
import { NaukriProfile } from '../src/naukri/profile.ts';

const KEY = 'test-key-0123456789';
const calls: unknown[] = [];

// Stubbed services: tests the HTTP contract (auth, validation, error mapping) without hitting Naukri.
const services = {
  auth: { status: { loggedIn: true, loginTime: null } },
  profile: {
    full: async () => ({ profile: [{ profileId: 'p1' }] }),
    update: async (f: unknown) => (calls.push(f), { profileId: 'p1', response: {} }),
    editable: async () => ({ headline: 'h', keySkills: [] }),
    lookup: async (...a: unknown[]) => (calls.push(a), [{ id: 139, name: 'Pune' }]),
    options: async (list: string) => (calls.push(list), [{ id: 12, name: 'B.Tech/B.E.', parentId: 0 }]),
    uploadResume: async (b: Buffer, name: string) => (calls.push([b.length, name]), { profileId: 'p1', response: {} }),
    applicationDetail: async (...a: unknown[]) => (calls.push(a), { totalApplicants: 1 }),
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

test('application detail validates jobId and passes applyType', async () => {
  assert.equal((await call('/api/applications/abc')).status, 400);
  assert.equal((await call('/api/applications/123?applyType=BROADCAST')).status, 200);
  assert.deepEqual(calls.at(-1), ['123', 'BROADCAST']);
});

test('profile update needs at least one field', async () => {
  assert.deepEqual(await (await call('/api/profile')).json(), { profile: [{ profileId: 'p1' }] });
  assert.equal((await call('/api/profile', { method: 'PATCH', body: '{}' })).status, 400);
  assert.equal((await call('/api/profile', { method: 'PATCH', body: '{"headline":"Backend"}' })).status, 200);
});

test('profile update takes key skills and the career profile', async () => {
  const patch = (body: object) => call('/api/profile', { method: 'PATCH', body: JSON.stringify(body) });
  const career = {
    keySkills: ['Node.js'],
    desiredRoles: [{ id: 119913, name: 'Forward Deployed Software Engineer' }],
    preferredLocations: [{ id: 139, name: 'Pune' }],
    expectedSalary: { amount: 1800000 },
    noticePeriodId: 1,
  };
  assert.equal((await patch(career)).status, 200);
  assert.deepEqual(calls.at(-1), { ...career, expectedSalary: { amount: 1800000, currency: 'INR' } });
  assert.equal((await patch({ noticePeriodId: 9 })).status, 400);
  assert.equal((await patch({ desiredRoles: [1, 2, 3, 4].map((id) => ({ id, name: 'r' })) })).status, 400);
  assert.equal((await patch({ expectedSalary: { amount: -1 } })).status, 400);
  assert.equal((await patch({ keySkills: Array.from({ length: 30 }, (_, i) => `skill number ${i}`) })).status, 400);
  assert.equal((await call('/api/profile/editable')).status, 200);
});

test('profile update takes sections, basics, personal details and deletes', async () => {
  const patch = (body: object) => call('/api/profile', { method: 'PATCH', body: JSON.stringify(body) });
  const body = {
    basics: { city: { id: 139, name: 'Pune' } },
    personal: { pincode: '500081' },
    sections: {
      employments: [{ id: 'emp1', current: true, designation: { id: '5555', name: 'SE 2' }, company: { id: null, name: 'Acme' }, start: '2025-11', description: 'Built things' }],
      onlineProfiles: [{ name: 'GitHub', url: 'https://github.com/x' }],
    },
    remove: [{ section: 'projects', id: 'p1' }],
  };
  assert.equal((await patch(body)).status, 200);
  const saved = calls.at(-1) as any;
  assert.deepEqual(saved.sections.employments[0], { ...body.sections.employments[0], end: null, skills: [], experienceType: 'F' });
  assert.deepEqual(saved.sections.onlineProfiles[0], { name: 'GitHub', url: 'https://github.com/x', description: '' });
  assert.equal((await patch({ sections: { employments: [{ current: true, start: '2025-13' }] } })).status, 400);
  assert.equal((await patch({ remove: [{ section: 'nope', id: 'x' }] })).status, 400);
  assert.equal((await patch({ personal: { pincode: '12' } })).status, 400);
  assert.equal((await patch({ personal: { maritalStatus: 'N' } })).status, 200);
  assert.equal((await patch({ personal: { maritalStatus: { id: 1, name: 'Single/unmarried' } } })).status, 400);
});

test('dropdown options are limited to the known lists', async () => {
  assert.deepEqual(await (await call('/api/profile/options/UGCOURSE')).json(), [{ id: 12, name: 'B.Tech/B.E.', parentId: 0 }]);
  assert.equal((await call('/api/profile/options/SECRET')).status, 400);
});

test('update deletes first, then saves the profile fields, then each section item', async () => {
  const posts: { url: string; body: any; override?: string }[] = [];
  const http = {
    post: async (url: string, o: any) => (posts.push({ url, body: o.json, override: o.headers['x-http-method-override'] }), { ok: true, statusCode: 200, text: '{}', json: () => ({}) }),
  };
  class Stub extends NaukriProfile {
    override profileId = async () => 'P';
  }
  const profile = new Stub(http as any, { authHeaders: async (h: object) => h } as any);
  const result = await profile.update({
    headline: 'H',
    sections: { itSkills: [{ skill: { id: '1', name: 'Go' }, version: '', lastUsed: null, experience: { years: 1, months: 0 } }, { id: 's2', skill: { id: '2', name: 'Rust' }, version: '', lastUsed: null, experience: { years: 0, months: 6 } }] },
    remove: [{ section: 'onlineProfiles', id: 'op 1' }],
  });
  assert.deepEqual(result, { profileId: 'P', saved: 3, removed: 1 });
  assert.equal(posts[0].url.endsWith('/profiles/P/onlineProfiles/op%201'), true);
  assert.equal(posts[0].override, 'DELETE');
  assert.deepEqual(posts[1].body, { profile: { resumeHeadline: 'H' }, profileId: 'P' });
  assert.deepEqual(posts.slice(2).map((p) => p.body.itskills[0].entitySkill), ['Go', 'Rust']);
  assert.equal(posts[3].body.itskills[0].sid, 's2');
});

test('taxonomy lookup validates type and query', async () => {
  assert.deepEqual(await (await call('/api/profile/lookup?type=location&q=pune')).json(), [{ id: 139, name: 'Pune' }]);
  assert.deepEqual(calls.at(-1), ['location', 'pune']);
  assert.equal((await call('/api/profile/lookup?type=city&q=pune')).status, 400);
  assert.equal((await call('/api/profile/lookup?type=company&q=7edge')).status, 200);
  assert.equal((await call('/api/profile/lookup?type=location&q=p')).status, 400);
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

test("Naukri's daily apply quota 403 is a 429 quota error, not an auth error", async () => {
  const { ensureOk } = await import('../src/common/http.ts');
  const { NaukriAuthError, NaukriQuotaError } = await import('../src/common/errors.ts');
  const res = (statusCode: number, body: object) =>
    ({ statusCode, ok: false, reason: 'Forbidden', text: JSON.stringify(body), json: () => body }) as any;
  const quota = { message: 'Daily quota of jobs exceeded', statusCode: 403, validationErrors: [{ customErrorCode: 403009 }] };
  assert.throws(() => ensureOk(res(403, quota), 'Apply'), (e: any) => e instanceof NaukriQuotaError && e.status === 429);
  assert.throws(() => ensureOk(res(403, { message: 'nope' }), 'Apply'), NaukriAuthError);
});
