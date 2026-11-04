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
    { name: 'Auth', description: 'Naukri session' },
    { name: 'Jobs', description: 'Find and apply to jobs' },
    { name: 'Profile', description: 'Profile, resume and applications' },
    { name: 'System' },
  ],
  security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
  paths: {
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
        tags: ['Auth'],
        summary: 'Session status',
        responses: { '200': json(ref('AuthStatus')), '401': commonErrors['401'] },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in with the configured credentials',
        responses: { '200': json(ref('AuthStatus')), '401': commonErrors['401'], '502': commonErrors['502'] },
      },
    },
    '/api/auth/token': {
      post: {
        tags: ['Auth'],
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
        tags: ['Auth'],
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
        tags: ['Auth'],
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
        tags: ['Jobs'],
        summary: 'Recommended jobs',
        responses: { '200': json({ type: 'array', items: ref('Job') }), '401': commonErrors['401'], '502': commonErrors['502'] },
      },
    },
    '/api/jobs/search': {
      get: {
        tags: ['Jobs'],
        summary: 'Search jobs',
        parameters: [
          q('keyword', { type: 'string', minLength: 1 }, 'Search text.', { required: true, example: 'node.js developer' }),
          q('location', { type: 'string' }, 'City or region.', { example: 'Bengaluru' }),
          q('page', { type: 'integer', minimum: 1 }, 'Page number.'),
          q('jobAge', { type: 'integer', minimum: 1 }, 'Only jobs posted within this many days.'),
          q('experience', { type: 'integer', minimum: 0, maximum: 50 }, 'Years of experience.'),
          q('resultsPerPage', { type: 'integer', minimum: 1, maximum: 100 }, 'Page size.'),
          q('latLong', { type: 'string' }, 'Coordinates, `lat,long`.'),
        ],
        responses: { '200': json({ type: 'array', items: ref('Job') }), ...commonErrors },
      },
    },
    '/api/jobs/{jobId}': {
      get: {
        tags: ['Jobs'],
        summary: 'Job details',
        parameters: [jobIdParam, sidParam],
        responses: { '200': json(ref('JobDetails')), ...commonErrors },
      },
    },
    '/api/jobs/{jobId}/apply': {
      post: {
        tags: ['Jobs'],
        summary: 'Apply to a job',
        description:
          'If the job has a questionnaire, the response has `questionnaireRequired: true`; send the answers in `answers` and apply again.',
        parameters: [jobIdParam],
        requestBody: {
          required: false,
          content: { 'application/json': { schema: ref('ApplyRequest') } },
        },
        responses: { '200': json(ref('ApplyResult')), ...commonErrors },
      },
    },
    '/api/profile/id': {
      get: {
        tags: ['Profile'],
        summary: 'Profile ID',
        responses: {
          '200': json({ type: 'object', properties: { profileId: { type: 'string' } } }),
          '401': commonErrors['401'],
          '502': commonErrors['502'],
        },
      },
    },
    '/api/profile': {
      patch: {
        tags: ['Profile'],
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
      put: {
        tags: ['Profile'],
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
        tags: ['Profile'],
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
      JobDetails: {
        type: 'object',
        properties: {
          externalApply: { type: 'boolean', description: 'The job applies on the company site, not Naukri.' },
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
            description: 'Questionnaire answers keyed by questionId. Text answers are strings, option answers are arrays of option keys.',
            additionalProperties: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
          },
        },
      },
      ApplyResult: {
        type: 'object',
        properties: {
          questionnaireRequired: { type: 'boolean' },
          result: { type: 'object', additionalProperties: true, description: "Naukri's apply response." },
        },
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
