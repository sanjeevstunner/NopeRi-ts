import { FILTER_PARAMS } from '../naukri/constants.ts';
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

const errorResponse = (description: string, code: string, message: string) => ({
  description,
  content: { 'application/json': { schema: ref('Error'), example: { error: { code, message } } } },
});

const json = (schema: unknown, description = 'Success.') => ({
  description,
  content: { 'application/json': { schema } },
});

const commonErrors = {
  '400': errorResponse('Invalid request.', 'VALIDATION_ERROR', 'Invalid request'),
  '401': errorResponse('Missing or wrong API key, or Naukri rejected the login.', 'UNAUTHORIZED', 'Missing or invalid API key'),
  '502': errorResponse('Naukri failed or could not be reached.', 'NAUKRI_UPSTREAM', 'Naukri request failed'),
};

const jobIdParam = {
  name: 'jobId',
  in: 'path',
  required: true,
  description: 'Numeric Naukri job ID.',
  schema: { type: 'string', pattern: '^\\d+$' },
  example: '010125000123',
};
const sidParam = {
  name: 'sid',
  in: 'query',
  required: false,
  description: 'Search session ID from a previous search, for better apply attribution.',
  schema: { type: 'string', pattern: '^\\d+$' },
};

const q = (name: string, schema: Record<string, unknown>, description: string, extra: object = {}) => ({
  name,
  in: 'query',
  required: false,
  description,
  schema,
  ...extra,
});

const gulfJobId = { ...jobIdParam, description: 'Numeric NaukriGulf job ID.', example: '111126000452' };
const raw = (d: string) => json({ type: 'object', additionalProperties: true }, d);
const gulfErrors = { '400': commonErrors['400'], '401': commonErrors['401'], '502': commonErrors['502'] };

/** NaukriGulf routes (enabled when NAUKRIGULF_USERNAME / NAUKRIGULF_PASSWORD are set; 404 otherwise). */
const gulfPaths = {
  '/api/gulf/auth/status': {
    get: { tags: ['NaukriGulf · Auth'], summary: 'NaukriGulf session status', responses: { '200': json(ref('AuthStatus')), '401': commonErrors['401'] } },
  },
  '/api/gulf/auth/login': {
    post: { tags: ['NaukriGulf · Auth'], summary: 'Log in to NaukriGulf with the configured credentials', responses: { '200': json(ref('AuthStatus')), ...gulfErrors } },
  },
  '/api/gulf/profile': {
    get: {
      tags: ['NaukriGulf · Profile'],
      summary: 'Profile section',
      parameters: [q('section', { type: 'string', default: 'mnjWidget', pattern: '^\\w+$' }, 'Profile section name.')],
      responses: { '200': raw("NaukriGulf's profile JSON."), ...gulfErrors },
    },
  },
  '/api/gulf/jobs/recommended': {
    get: { tags: ['NaukriGulf · Jobs'], summary: 'Recommended jobs', responses: { '200': raw("NaukriGulf's raw recommendations."), ...gulfErrors } },
  },
  '/api/gulf/jobs/search': {
    get: {
      tags: ['NaukriGulf · Jobs'],
      summary: 'Search jobs (no login needed)',
      parameters: [
        { name: 'keyword', in: 'query', required: true, schema: { type: 'string', minLength: 1 }, example: 'python' },
        q('location', { type: 'string' }, 'City or country.', { example: 'dubai' }),
        q('page', { type: 'integer', minimum: 1 }, 'Page number, starting at 1.'),
        q('experience', { type: 'integer', minimum: 0, maximum: 50 }, 'Years of experience.'),
        q('resultsPerPage', { type: 'integer', minimum: 1, maximum: 100, default: 30 }, 'Page size.'),
      ],
      responses: {
        '200': json({
          type: 'object',
          properties: { jobs: { type: 'array', items: ref('Job') }, total: { type: 'integer' }, searchId: { type: ['string', 'null'] } },
        }),
        ...gulfErrors,
      },
    },
  },
  '/api/gulf/jobs/{jobId}': {
    get: { tags: ['NaukriGulf · Jobs'], summary: 'Job details', parameters: [gulfJobId], responses: { '200': raw("NaukriGulf's raw job details."), ...gulfErrors } },
  },
};

export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'NopeRi API',
    version: '1.0.0',
    description:
      'REST interface to a Naukri.com account: log in, search and apply to jobs, update the profile and resume, and read application history.\n\n' +
      'The server logs in with `NAUKRI_USERNAME` / `NAUKRI_PASSWORD` as needed; use the `/api/auth` endpoints to inspect or replace the session.',
  },
  servers: [{ url: '/', description: 'This server' }],
  tags: [
    { name: 'System' },
    { name: 'Naukri · Auth', description: 'Naukri.com session' },
    { name: 'Naukri · Jobs', description: 'Find and apply to Naukri jobs' },
    { name: 'Naukri · Profile', description: 'Naukri profile, resume and applications' },
    { name: 'NaukriGulf · Auth', description: 'NaukriGulf session (`/api/gulf`, needs NAUKRIGULF_* in .env)' },
    { name: 'NaukriGulf · Jobs', description: 'Search and read NaukriGulf jobs' },
    { name: 'NaukriGulf · Profile', description: 'NaukriGulf profile' },
  ],
  // Grouping for Redoc-style viewers; Swagger UI ignores it and shows the "Site · Section" tag names in this order.
  'x-tagGroups': [
    { name: 'System', tags: ['System'] },
    { name: 'Naukri', tags: ['Naukri · Auth', 'Naukri · Jobs', 'Naukri · Profile'] },
    { name: 'NaukriGulf', tags: ['NaukriGulf · Auth', 'NaukriGulf · Jobs', 'NaukriGulf · Profile'] },
  ],
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  paths: {
    ...gulfPaths,
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Liveness check',
        security: [],
        responses: {
          '200': json({ type: 'object', properties: { ok: { type: 'boolean', example: true } } }, 'The server is up.'),
        },
      },
    },
    '/api/auth/status': {
      get: {
        tags: ['Naukri · Auth'],
        summary: 'Session status',
        responses: { '200': json(ref('AuthStatus')), '401': commonErrors['401'] },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Naukri · Auth'],
        summary: 'Log in with the configured credentials',
        responses: { '200': json(ref('AuthStatus')), '401': commonErrors['401'], '502': commonErrors['502'] },
      },
    },
    '/api/auth/token': {
      post: {
        tags: ['Naukri · Auth'],
        summary: 'Use an existing Naukri token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token'],
                properties: { token: { type: 'string', minLength: 20, description: 'Naukri access token (`nauk_at` cookie).' } },
              },
            },
          },
        },
        responses: { '200': json(ref('AuthStatus')), '400': commonErrors['400'], '401': commonErrors['401'] },
      },
    },
    '/api/auth/otp/send': {
      post: {
        tags: ['Naukri · Auth'],
        summary: 'Send a login OTP',
        requestBody: {
          required: false,
          content: { 'application/json': { schema: ref('OtpTarget') } },
        },
        responses: {
          '200': json({ type: 'object', additionalProperties: true }, "Naukri's response."),
          '400': commonErrors['400'],
          '401': commonErrors['401'],
          '502': commonErrors['502'],
        },
      },
    },
    '/api/auth/otp/verify': {
      post: {
        tags: ['Naukri · Auth'],
        summary: 'Verify an OTP and log in',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: ref('VerifyOtp'), example: { otp: '123456', isMobile: true } } },
        },
        responses: { '200': json(ref('AuthStatus')), '400': commonErrors['400'], '401': commonErrors['401'], '502': commonErrors['502'] },
      },
    },
    '/api/jobs/recommended': {
      get: {
        tags: ['Naukri · Jobs'],
        summary: 'Recommended jobs',
        responses: { '200': json({ type: 'array', items: ref('Job') }), '401': commonErrors['401'], '502': commonErrors['502'] },
      },
    },
    '/api/jobs/search': {
      get: {
        tags: ['Naukri · Jobs'],
        summary: 'Search jobs',
        parameters: [
          q('keyword', { type: 'string', minLength: 1 }, 'Search text.', { required: true, example: 'node.js developer' }),
          q('location', { type: 'string' }, 'City or region.', { example: 'Bengaluru' }),
          q('page', { type: 'integer', minimum: 1 }, 'Page number.'),
          q('jobAge', { type: 'integer', minimum: 1 }, 'Only jobs posted within this many days.'),
          q('experience', { type: 'integer', minimum: 0, maximum: 50 }, 'Years of experience.'),
          q('resultsPerPage', { type: 'integer', minimum: 1, maximum: 100 }, 'Page size.'),
          q('latLong', { type: 'string' }, 'Coordinates, `lat,long`.'),
          ...Object.keys(FILTER_PARAMS).map((key) =>
            q(`filter.${key}`, { type: 'array', items: { type: 'string' } }, `Filter by \`clusters.${key}\` ids. Repeat to select several.`, {
              style: 'form',
              explode: true,
            }),
          ),
        ],
        responses: { '200': json(ref('SearchResult')), ...commonErrors },
      },
    },
    '/api/jobs/{jobId}': {
      get: {
        tags: ['Naukri · Jobs'],
        summary: 'Job details',
        parameters: [jobIdParam, sidParam],
        responses: { '200': json(ref('JobDetails')), ...commonErrors },
      },
    },
    '/api/jobs/{jobId}/apply': {
      post: {
        tags: ['Naukri · Jobs'],
        summary: 'Apply to a job',
        description:
          'If the job has a questionnaire, the response has `questionnaireRequired: true`; apply again with the same `sid` and the answers in `answers`, leaving out `skippable` questions. `applied: true` is Naukri\'s confirmation.\n\n' +
          'Send multipart with a `resume` PDF to apply with a tailored resume: the current profile resume is backed up, replaced for the apply, and restored afterwards, even if the apply fails. Send the resume again on a questionnaire follow-up.',
        parameters: [jobIdParam],
        requestBody: {
          required: false,
          content: {
            'application/json': { schema: ref('ApplyRequest') },
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['resume'],
                properties: {
                  resume: { type: 'string', format: 'binary', description: 'PDF, up to 5 MB. Attached for this apply only.' },
                  data: { type: 'string', description: 'The ApplyRequest body as a JSON string.' },
                },
              },
            },
          },
        },
        responses: {
          '200': json(ref('ApplyResult')),
          ...commonErrors,
          '429': errorResponse("Naukri's daily apply limit is used up. Try again tomorrow.", 'NAUKRI_QUOTA', 'Apply: Daily quota of jobs exceeded'),
        },
      },
    },
    '/api/profile/id': {
      get: {
        tags: ['Naukri · Profile'],
        summary: 'Profile ID',
        responses: {
          '200': json({ type: 'object', properties: { profileId: { type: 'string' } } }),
          '401': commonErrors['401'],
          '502': commonErrors['502'],
        },
      },
    },
    '/api/profile': {
      get: {
        tags: ['Naukri · Profile'],
        summary: 'Full profile',
        description: "Naukri's profile response as-is: `user`, `profile` (incl. `cvInfo`), `employments`, `educations`, `itskills`, `projects`, `certifications` and more.",
        responses: {
          '200': json({ type: 'object', additionalProperties: true }, "Naukri's full profile."),
          '401': commonErrors['401'],
          '502': commonErrors['502'],
        },
      },
      patch: {
        tags: ['Naukri · Profile'],
        summary: 'Update headline, name or summary',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                minProperties: 1,
                properties: {
                  headline: { type: 'string', minLength: 1, maxLength: 250 },
                  name: { type: 'string', minLength: 1, maxLength: 100 },
                  summary: { type: 'string', minLength: 1, maxLength: 1000 },
                },
              },
            },
          },
        },
        responses: { '200': json({ type: 'object', additionalProperties: true }, "Naukri's response."), ...commonErrors },
      },
    },
    '/api/profile/resume': {
      get: {
        tags: ['Naukri · Profile'],
        summary: 'Download the current resume',
        responses: {
          '200': { description: 'The PDF, with its Naukri filename in Content-Disposition.', content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } } },
          '401': commonErrors['401'],
          '502': commonErrors['502'],
        },
      },
      put: {
        tags: ['Naukri · Profile'],
        summary: 'Upload a resume',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['resume'],
                properties: { resume: { type: 'string', format: 'binary', description: 'PDF, up to 5 MB.' } },
              },
            },
          },
        },
        responses: {
          '200': json({ type: 'object', additionalProperties: true }, "Naukri's response."),
          '413': errorResponse('File too large.', 'VALIDATION_ERROR', 'File too large'),
          ...commonErrors,
        },
      },
    },
    '/api/applications': {
      get: {
        tags: ['Naukri · Profile'],
        summary: 'Application history',
        parameters: [
          q('pageSize', { type: 'integer', minimum: 1, maximum: 100 }, 'Page size.'),
          q('days', { type: 'integer', minimum: 1, maximum: 365 }, 'Look back this many days.'),
          q('pageNumber', { type: 'integer', minimum: 1 }, 'Page number.'),
          q('mobile', { type: 'boolean' }, 'Use the mobile endpoint.'),
        ],
        responses: { '200': json({ type: 'array', items: ref('ApplicationHistory') }), ...commonErrors },
      },
    },
    '/api/applications/{jobId}': {
      get: {
        tags: ['Naukri · Profile'],
        summary: 'Application detail',
        description: 'Status timeline plus how you compare with other applicants (history-description).',
        parameters: [
          { name: 'jobId', in: 'path', required: true, schema: { type: 'string', pattern: '^\\d+$' } },
          q('applyType', { type: 'string', default: 'normal' }, 'Apply type from the history list (`normal`, `BROADCAST`...).'),
        ],
        responses: { '200': json(ref('ApplicationDetail')), ...commonErrors },
      },
    },
  },
  components: {
    securitySchemes: {
      ApiKeyHeader: { type: 'apiKey', in: 'header', name: 'x-api-key', description: 'The server `API_KEY`.' },
      BearerAuth: { type: 'http', scheme: 'bearer', description: 'Same key as `x-api-key`, sent as `Authorization: Bearer <key>`.' },
    },
    schemas: {
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string' },
              upstreamStatus: { type: 'integer' },
              detail: { type: 'string' },
              issues: {
                type: 'array',
                items: { type: 'object', properties: { path: { type: 'string' }, message: { type: 'string' } } },
              },
            },
          },
        },
      },
      AuthStatus: {
        type: 'object',
        properties: {
          loggedIn: { type: 'boolean' },
          loginTime: { type: ['string', 'null'], format: 'date-time' },
        },
      },
      OtpTarget: {
        type: 'object',
        properties: {
          username: { type: 'string', description: 'Defaults to the configured username.' },
          isMobile: { type: 'boolean', default: true, description: 'Username is a mobile number rather than an email.' },
        },
      },
      VerifyOtp: {
        type: 'object',
        required: ['otp'],
        properties: {
          otp: { type: 'string', pattern: '^\\d{4,8}$' },
          username: { type: 'string' },
          isMobile: { type: 'boolean', default: true },
        },
      },
      Job: {
        type: 'object',
        properties: {
          jobId: { type: 'string' },
          title: { type: 'string' },
          company: { type: 'string' },
          location: { type: 'string' },
          experience: { type: 'string' },
          salary: { type: 'string' },
          postedDate: { type: 'string' },
          applyLink: { type: 'string' },
          description: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
        },
      },
      Cluster: {
        type: 'object',
        properties: { id: { type: 'string' }, count: { type: 'integer' }, label: { type: 'string' } },
      },
      SearchResult: {
        type: 'object',
        properties: {
          jobs: { type: 'array', items: ref('Job') },
          total: { type: 'integer', description: 'Total matching jobs across all pages.' },
          clusters: {
            type: 'object',
            description: 'Filter groups keyed by cluster key; send ids back as `filter.<key>`.',
            additionalProperties: { type: 'array', items: ref('Cluster') },
          },
          clusterOrder: { type: 'array', items: { type: 'string' }, description: "Naukri's display order for `clusters`." },
        },
      },
      JobDetails: {
        type: 'object',
        properties: {
          externalApply: { type: 'boolean', description: 'The job applies on the company site, not Naukri.' },
          skills: {
            type: 'object',
            description: 'Skills to pass as mandatorySkills/optionalSkills when applying.',
            properties: {
              mandatory: { type: 'array', items: { type: 'string' } },
              optional: { type: 'array', items: { type: 'string' } },
            },
          },
          details: { type: 'object', additionalProperties: true, description: "Naukri's job detail payload." },
        },
      },
      ApplyRequest: {
        type: 'object',
        properties: {
          mandatorySkills: { type: 'array', items: { type: 'string' } },
          optionalSkills: { type: 'array', items: { type: 'string' } },
          sid: { type: 'string', pattern: '^\\d+$' },
          source: { type: 'string', enum: ['recommended', 'search'] },
          answers: {
            type: 'object',
            description: 'Questionnaire answers keyed by questionId. Text answers are strings (max 100 characters), option answers are arrays of option labels, e.g. ["Yes"].',
            additionalProperties: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
          },
        },
      },
      ApplyResult: {
        type: 'object',
        properties: {
          applied: { type: 'boolean', description: "Naukri confirmed the application (applyStatus 200)." },
          status: { type: 'integer', nullable: true, description: "Naukri's apply status for the job; 200 is applied." },
          message: { type: 'string', nullable: true, description: "Naukri's message, e.g. \"You have successfully applied to this job.\"" },
          sid: { type: 'string', description: 'The sid used; send it again with the answers.' },
          questionnaireRequired: { type: 'boolean' },
          questionnaire: {
            type: 'array',
            description: 'The questions to answer; empty when none. Apply again with `answers` keyed by `id`.',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                text: { type: 'string' },
                type: { type: 'string', enum: ['text', 'choice', 'multi'] },
                options: { type: 'object', additionalProperties: { type: 'string' }, description: 'Option key → label.' },
                required: { type: 'boolean' },
                skippable: { type: 'boolean', description: 'Naukri fills it from the Naukri profile; leave it out of answers.' },
                prefill: { type: 'array', items: { type: 'string' } },
              },
            },
          },
          result: { type: 'object', additionalProperties: true, description: "Naukri's apply response." },
        },
      },
      ApplicationDetail: {
        allOf: [
          ref('ApplicationHistory'),
          {
            type: 'object',
            properties: {
              totalApplicants: { type: 'integer' },
              applyMatchScore: { type: ['string', 'null'], description: 'e.g. LOW / MEDIUM / HIGH.' },
              matching: { type: 'object', additionalProperties: true, description: 'Industry, experience, location... vs other applicants.' },
            },
          },
        ],
      },
      ApplicationHistory: {
        type: 'object',
        properties: {
          jobId: { type: 'string' },
          jobTitle: { type: 'string' },
          company: { type: 'string' },
          location: { type: 'string' },
          applyType: { type: 'string' },
          isOpen: { type: 'boolean' },
          arsScore: { type: 'number' },
          starRating: { type: 'string' },
          jobType: { type: 'string' },
          statuses: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                statusId: { type: 'integer' },
                statusValue: { type: 'string' },
                dateTime: { type: 'string' },
              },
            },
          },
          companyRating: { type: ['number', 'null'] },
          logoPath: { type: ['string', 'null'] },
        },
      },
    },
  },
} as const;
