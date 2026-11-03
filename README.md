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

### Docker

```bash
docker build -t noperi-ts .
docker run -d --name noperi -p 3000:3000 --env-file .env noperi-ts
```

> **Hosting:** Naukri ties sessions to the IP that logged in and flags most datacenter ranges (Azure, GitHub Actions, some GCP). Run it from a home server or an EC2 instance with an Elastic IP, or set `NAUKRI_PROXY` to a residential proxy. Run a single instance. Don't scale out behind a load balancer.

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
| GET | `/api/auth/status` | | `{ loggedIn, loginTime }` |
| POST | `/api/auth/login` | | Logs in again with the `.env` credentials. Other routes log in automatically on first use. |
| POST | `/api/auth/otp/send` | `{ username?, isMobile? }` | Use when Naukri demands OTP/MFA |
| POST | `/api/auth/otp/verify` | `{ otp, username?, isMobile? }` | Completes the OTP login |
| GET | `/api/profile/id` | | |
| PATCH | `/api/profile` | `{ headline?, name?, summary? }` | At least one field |
| PUT | `/api/profile/resume?filename=cv.pdf` | raw PDF, `Content-Type: application/pdf` | Max 5 MB |
| GET | `/api/applications` | `?pageSize&days&pageNumber&mobile` | Application history |
| GET | `/api/jobs/recommended` | | |
| GET | `/api/jobs/search` | `?keyword` (required) `&location&page&experience&jobAge&resultsPerPage&latLong` | No login needed |
| GET | `/api/jobs/:jobId` | `?sid` | `{ externalApply, details }` |
| POST | `/api/jobs/:jobId/apply` | `{ mandatorySkills?, optionalSkills?, source?, sid?, answers? }` | Returns `{ questionnaireRequired, result }` |

Error codes: `UNAUTHORIZED` (bad API key), `VALIDATION_ERROR` (400), `NAUKRI_AUTH` (401: login failed, OTP needed, or token expired), `NAUKRI_UPSTREAM` / `NAUKRI_UNREACHABLE` (502).

**Questionnaires:** if `apply` returns `questionnaireRequired: true`, read the questions from `result.jobs[0].questionnaire` and call `apply` again with `answers` keyed by `questionId`. Text answers are strings. Option answers are arrays of option keys, e.g. `{ "Q1": "5", "Q2": ["opt_yes"] }`.

```bash
curl -H "x-api-key: $API_KEY" "localhost:3000/api/jobs/search?keyword=node.js&location=hyderabad&experience=2"
curl -X PUT -H "x-api-key: $API_KEY" -H "content-type: application/pdf" \
     --data-binary @resume.pdf "localhost:3000/api/profile/resume?filename=resume.pdf"
```

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
