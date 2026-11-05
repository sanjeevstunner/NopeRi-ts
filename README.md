# noperi-ts

A TypeScript port of [NopeRi](../NopeRi): a Naukri.com API client with an Express REST interface. You can use it as a library or run it as a server, and call it from web apps, services or automation tools such as n8n and cron jobs.

It covers the client APIs only: login and OTP, profile, resume, application history, job search, recommendations, details and apply. The automation layer from the Python project (AI scoring, the apply agent, CSV tracking, the Selenium token harvester) is not included.

## Run

Requires Node 24+. Node runs the TypeScript directly, so there is no build step.

```bash
cp .env.example .env      # fill in API_KEY and Naukri credentials
npm install
npm start                 # or: npm run dev (watch mode)
```

### Docker Compose

```bash
cp .env.example .env              # fill it in first
docker compose up -d --build      # build and start in the background
docker compose logs -f            # follow logs
docker compose down               # stop and remove
```

The port comes from `PORT` in `.env` (default `3000`). The container restarts automatically unless you stop it.

Without Compose:

```bash
docker build -t noperi-ts .
docker run -d --name noperi -p 3000:3000 --env-file .env noperi-ts
```

> **Hosting:** Naukri ties sessions to the IP that logged in and flags most datacenter ranges (Azure, GitHub Actions, some GCP). Run it from a home server or an EC2 instance with an Elastic IP, or set `NAUKRI_PROXY` to a residential proxy. Run a single instance. Don't scale out behind a load balancer.

## Setting up `API_KEY`

`API_KEY` is not a Naukri key. Naukri has no public API keys, and this project doesn't need one because it logs in with your normal Naukri email and password, the way the website does.

`API_KEY` is a password you make up for your own server. Callers have to send it before the server will act on your Naukri account. Without it, anyone who can reach the server could apply to jobs or change your profile.

1. Generate a random key:
   ```bash
   node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
   ```
2. Put it in `.env` with your Naukri login:
   ```env
   API_KEY=<paste the generated value>
   NAUKRI_USERNAME=your_naukri_email@example.com
   NAUKRI_PASSWORD=your_naukri_password
   ```
3. Send the same value on every `/api/*` call, as `x-api-key` or `Authorization: Bearer`:
   ```bash
   curl -H "x-api-key: <your key>" "localhost:3000/api/jobs/search?keyword=python"
   ```

Any string of 16 or more characters works, but a random one is safer. Keep it on your web app's server side and never put it in browser JavaScript, or anyone could read it.

## Configuration (`.env`)

| Variable | Required | Description |
|---|---|---|
| `API_KEY` | yes | Shared secret clients send as `x-api-key` or `Authorization: Bearer`. Min 16 chars. |
| `NAUKRI_USERNAME` | yes | Naukri login email or phone |
| `NAUKRI_PASSWORD` | yes | Naukri password |
| `PORT` | no | Default `3000` |
| `NAUKRI_PROXY` | no | `http://user:pass@host:port` or `socks5://host:port` |

## REST API

Every `/api/*` route needs the API key. Errors share one shape: `{ "error": { "code", "message", "upstreamStatus?", "detail?" } }`.

| Method | Path | Body / query | Notes |
|---|---|---|---|
| GET | `/health` | | Public liveness check |
| GET | `/docs` | | Interactive Swagger UI, public (use **Authorize** to set the API key); spec at `/openapi.json` |
| GET | `/api/auth/status` | | `{ loggedIn, loginTime }` |
| POST | `/api/auth/login` | | Logs in again with the `.env` credentials. Other routes log in automatically on first use. |
| POST | `/api/auth/token` | `{ token }` | Use when login/OTP demand a CAPTCHA: paste the `nauk_at` cookie from a logged-in browser |
| POST | `/api/auth/otp/send` | `{ username?, isMobile? }` | Use when Naukri demands OTP/MFA |
| POST | `/api/auth/otp/verify` | `{ otp, username?, isMobile? }` | Completes the OTP login |
| GET | `/api/profile/id` | | |
| PATCH | `/api/profile` | `{ headline?, name?, summary? }` | At least one field |
| PUT | `/api/profile/resume` | `multipart/form-data`, PDF in field `resume` | Max 5 MB. The uploaded filename is kept (sanitised) |
| GET | `/api/applications` | `?pageSize&days&pageNumber&mobile` | Application history |
| GET | `/api/jobs/recommended` | | |
| GET | `/api/jobs/search` | `?keyword` (required) `&location&page&experience&jobAge&resultsPerPage&latLong` | No login needed |
| GET | `/api/jobs/:jobId` | `?sid` | `{ externalApply, skills: { mandatory, optional }, details }` |
| POST | `/api/jobs/:jobId/apply` | `{ mandatorySkills?, optionalSkills?, source?, sid?, answers? }` | Returns `{ applied, message, sid, questionnaireRequired, questionnaire, result }` |

Error codes: `UNAUTHORIZED` (bad API key), `VALIDATION_ERROR` (400), `NAUKRI_AUTH` (401: login failed, OTP needed, or token expired), `NAUKRI_UPSTREAM` / `NAUKRI_UNREACHABLE` (502).

**Questionnaires:** if `apply` returns `questionnaireRequired: true`, read `questionnaire` (`[{ id, text, type: 'text'|'choice'|'multi', options, required, skippable, prefill }]`) and call `apply` again with the same `sid`, the same `mandatorySkills`/`optionalSkills` (from job details' `skills`) and `answers` keyed by `id`. Leave out `skippable` questions: Naukri fills them from the Naukri profile. Text answers are strings of at most 100 characters; choice answers are arrays of option **labels**, e.g. `{ "52869508": ["Yes"], "52869509": "Yes" }`. `applied: true` is Naukri's confirmation.

```bash
curl -H "x-api-key: $API_KEY" "localhost:3000/api/jobs/search?keyword=node.js&location=hyderabad&experience=2"
curl -X PUT -H "x-api-key: $API_KEY" -F "resume=@resume.pdf;type=application/pdf" \
     localhost:3000/api/profile/resume
```

From a browser, append the file to a `FormData` under `resume` and send it with `fetch(url, { method: 'PUT', body: form })`. Don't set `Content-Type` yourself, because the browser has to add the multipart boundary. A browser app on a different origin also needs CORS, which isn't enabled yet. Calling it from your own backend avoids CORS and keeps the API key out of the browser.

## Library use

```ts
import { createNaukriClient } from './src/naukri/index.ts';

const naukri = createNaukriClient({ username, password });
const jobs = await naukri.jobs.search({ keyword: 'python', location: 'pune' });
await naukri.profile.update({ headline: 'Backend Engineer' });
naukri.close();
```

## Layout

```
src/
  index.ts            # bootstrap: config → client → Express → listen
  config.ts           # .env validation (zod)
  naukri/             # standalone client, no Express dependency
    index.ts          #   createNaukriClient(): wires the services together
    http.ts           #   Chrome-fingerprinted session (httpcloak) + response helpers
    auth.ts           #   login, OTP, bearer token (lazy, deduplicated login)
    profile.ts        #   profile id, update, resume upload, application history
    jobs.ts           #   search, recommended, details, apply
    parsers.ts        #   pure helpers: nkparam signing, seoKey, parsers, formKey discovery
    constants.ts      #   URLs, header sets, RSA key
    errors.ts, types.ts
  api/                # Express layer: thin routes, zod validation, error mapping
test/                 # node:test: parsers + HTTP contract against stubbed services
```

`npm test` runs the tests and `npm run typecheck` runs `tsc`.

## Disclaimer

For automating your **own** Naukri account only. Follow [Naukri's Terms](https://www.naukri.com/termsAndConditions). Not affiliated with Naukri / InfoEdge.
