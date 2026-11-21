import { Router } from 'express';
import { z } from 'zod';
import type { NaukriProfile } from '../../naukri/profile.ts';
import { ResumeFile, resumeUpload } from '../upload.ts';
import { NOTICE_PERIODS, OPTION_LISTS } from '../../naukri/constants.ts';
import { cleanSkills } from '../../naukri/parsers.ts';
import { JobId, profileUpdateSchema } from './site.ts';

const Tag = z.object({ id: z.number().int().positive(), name: z.string().trim().min(1) });
const Ref = z.object({ id: z.string().trim().min(1).nullable(), name: z.string().trim().min(1).max(200) });
const Month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'use YYYY-MM');
const Text = (max: number) => z.string().trim().max(max).default('');
const Url = z.union([z.url().max(500), z.literal('')]).default('');
const Id = z.string().trim().min(1).max(200).optional();
const Years = z.object({ years: z.number().int().min(0).max(50), months: z.number().int().min(0).max(11) });
const Year = z.number().int().min(1950).max(2100).nullable();
const list = <T extends z.ZodType>(item: T) => z.array(item).max(50);

/** Each section's items: with an id to change one, without to add one. */
const Sections = z
  .object({
    employments: list(
      z.object({
        id: Id,
        current: z.boolean(),
        designation: Ref,
        company: Ref,
        start: Month,
        end: Month.nullable().default(null),
        description: Text(4000),
        skills: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
        experienceType: z.enum(['F', 'I']).default('F'),
      }),
    ),
    itSkills: list(
      z.object({ id: Id, skill: Ref, version: Text(20), lastUsed: Year.default(null), experience: Years }),
    ),
    educations: list(
      z.object({
        id: Id,
        level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        course: Tag,
        specialisation: Tag,
        institute: Ref,
        courseType: z.enum(['F', 'P', 'C']).default('F'),
        startYear: Year.default(null),
        endYear: Year.default(null),
        grade: Tag.nullable().default(null),
        marks: Text(10),
        primary: z.boolean().default(false),
      }),
    ),
    projects: list(
      z.object({
        id: Id,
        title: z.string().trim().min(1).max(250),
        client: z.string().trim().min(1).max(250),
        details: Text(4000),
        skills: Text(500),
        role: Text(250),
        start: Month,
        end: Month.nullable().default(null),
      }),
    ),
    onlineProfiles: list(z.object({ id: Id, name: z.string().trim().min(1).max(100), url: z.url().max(500), description: Text(500) })),
    workSamples: list(
      z.object({
        id: Id,
        title: z.string().trim().min(1).max(250),
        url: z.url().max(500),
        description: Text(1000),
        start: Month.nullable().default(null),
        end: z.union([Month, z.literal('current')]).nullable().default(null),
      }),
    ),
    publications: list(
      z.object({ id: Id, title: z.string().trim().min(1).max(250), url: Url, description: Text(1000), published: Month.nullable().default(null) }),
    ),
    presentations: list(z.object({ id: Id, title: z.string().trim().min(1).max(250), url: z.url().max(500), description: Text(1000) })),
    patents: list(
      z.object({
        id: Id,
        title: z.string().trim().min(1).max(250),
        url: Url,
        description: Text(1000),
        applicationNumber: Text(50),
        office: Text(100),
        status: z.string().trim().min(1).max(5).default('a'),
        issued: Month.nullable().default(null),
      }),
    ),
    certifications: list(
      z.object({
        id: Id,
        name: Ref,
        url: Url,
        issued: Month.nullable().default(null),
        expires: z.union([Month, z.literal('never')]).nullable().default(null),
      }),
    ),
    languages: list(
      z.object({
        id: Id,
        language: z.string().trim().min(1).max(50),
        languageRef: z.string().trim().min(1).nullable().default(null),
        proficiency: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        read: z.boolean(),
        write: z.boolean(),
        speak: z.boolean(),
      }),
    ),
  })
  .partial();

const SECTION_NAMES = ['employments', 'itSkills', 'educations', 'projects', 'onlineProfiles', 'workSamples', 'publications', 'presentations', 'patents', 'certifications', 'languages'] as const;

/** Every editable field of the Naukri profile; at least one is required. */
export const ProfileUpdate = profileUpdateSchema(['headline', 'name', 'summary'], {
  // Naukri stores them comma-joined and rejects more than 250 characters ("Experience Keywords").
  keySkills: z
    .array(z.string().trim().min(1).max(100))
    .min(1)
    .max(50)
    .refine((skills) => cleanSkills(skills).join(',').length <= 250, 'at most 250 characters in all, commas included'),
  desiredRoles: z.array(Tag).min(1).max(3),
  preferredLocations: z.array(Tag).min(1).max(10),
  expectedSalary: z.object({ amount: z.number().int().positive(), currency: z.string().length(3).default('INR') }),
  noticePeriodId: z.number().int().refine((id) => id in NOTICE_PERIODS, 'unknown notice period'),
  basics: z
    .object({
      name: z.string().trim().min(1).max(100),
      city: Tag,
      experience: Years,
      currentSalary: z.object({ amount: z.number().int().positive(), currency: z.string().length(3).default('INR') }),
    })
    .partial(),
  personal: z
    .object({
      birthDate: z.iso.date().nullable(),
      gender: z.enum(['M', 'F']).nullable(),
      address: z.string().trim().max(500),
      hometown: z.string().trim().max(100),
      pincode: z.union([z.string().regex(/^\d{6}$/), z.literal('')]),
      maritalStatus: z.enum(['N', 'M', 'W', 'D', 'S', 'O']).nullable(),
    })
    .partial(),
  sections: Sections,
  remove: z.array(z.object({ section: z.enum(SECTION_NAMES), id: z.string().trim().min(1).max(200) })).max(100),
});

const Lookup = z.object({
  type: z.enum(['location', 'designation', 'company', 'institute', 'skill', 'certification']),
  q: z.string().trim().min(2).max(100),
});
const Options = z.enum(OPTION_LISTS);

const History = z.object({
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  days: z.coerce.number().int().min(1).max(365).optional(),
  pageNumber: z.coerce.number().int().min(1).optional(),
  mobile: z.stringbool().optional(),
});

/** Naukri-only profile routes. Read/update/download are in siteRoutes. */
export function profileRoutes(profile: NaukriProfile) {
  return Router()
    .get('/profile/id', async (_req, res) => {
      res.json({ profileId: await profile.profileId() });
    })
    .get('/profile/editable', async (_req, res) => {
      res.json(await profile.editable());
    })
    .get('/profile/lookup', async (req, res) => {
      const { type, q } = Lookup.parse(req.query);
      res.json(await profile.lookup(type, q));
    })
    .get('/profile/options/:list', async (req, res) => {
      res.json(await profile.options(Options.parse(req.params.list)));
    })
    .put('/profile/resume', resumeUpload, async (req, res) => {
      const { buffer, originalname } = ResumeFile.parse(req.file);
      res.json(await profile.uploadResume(buffer, originalname));
    })
    .get('/applications', async (req, res) => {
      res.json(await profile.applicationHistory(History.parse(req.query)));
    })
    .get('/applications/:jobId', async (req, res) => {
      const jobId = JobId.parse(req.params.jobId);
      const { applyType } = z.object({ applyType: z.string().min(1).optional() }).parse(req.query);
      res.json(await profile.applicationDetail(jobId, applyType));
    });
}
