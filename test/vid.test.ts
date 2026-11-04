import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NaukriAuth } from '../src/naukri/auth.ts';
import type { Http } from '../src/naukri/http.ts';
import { generateVid } from '../src/naukri/vid.ts';

test('generateVid returns a base64 token', async () => {
  assert.match(await generateVid(), /^[A-Za-z0-9+/]+=*$/);
});

test('login sends vid with the login appid', async () => {
  let headers: Record<string, string> = {};
  const http = {
    post: async (_url: string, opts: { headers: Record<string, string> }) => ((headers = opts.headers), { ok: true }),
    getCookie: () => ({ value: 'tok' }),
  } as unknown as Http;
  await new NaukriAuth(http, { username: 'u', password: 'p' }).login();
  assert.ok(headers.vid);
  assert.equal(headers.appid, '105');
});
