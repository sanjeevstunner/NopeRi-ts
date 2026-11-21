import type { Salary, Tag } from './types.ts';

// Every list section of a Naukri profile, each read from Naukri's full profile into a plain item and
// written back in the shape Naukri's own profile page saves it (resman fullprofiles, PUT override).
// The shapes come from Naukri's mnj bundle (submitEmployment, saveITSkills, saveEduDetails, ...).
// Pure functions: no I/O.

/** A Naukri entity (company, designation, skill, institute, certificate): its id, or null for free text. */
export interface Ref {
  id: string | null;
  name: string;
}

/** "2024-05" (year-month), the way items carry dates. */
type YearMonth = string;

export interface Employment {
  id?: string;
  current: boolean;
  designation: Ref;
  company: Ref;
  start: YearMonth;
  end: YearMonth | null;
  description: string;
  skills: string[];
  /** F: full time, I: internship. */
  experienceType: 'F' | 'I';
}

export interface ItSkill {
  id?: string;
  skill: Ref;
  version: string;
  lastUsed: number | null;
  experience: { years: number; months: number };
}

export interface Education {
  id?: string;
  /** 1: graduation/diploma, 2: masters, 3: doctorate. */
  level: 1 | 2 | 3;
  course: Tag;
  specialisation: Tag;
  institute: Ref;
  /** F: full time, P: part time, C: distance learning. */
  courseType: 'F' | 'P' | 'C';
  startYear: number | null;
  endYear: number | null;
  grade: Tag | null;
  marks: string;
  primary: boolean;
}

export interface Project {
  id?: string;
  title: string;
  client: string;
  details: string;
  skills: string;
  role: string;
  start: YearMonth;
  end: YearMonth | null;
}

export interface OnlineProfile {
  id?: string;
  name: string;
  url: string;
  description: string;
}

export interface WorkSample {
  id?: string;
  title: string;
  url: string;
  description: string;
  start: YearMonth | null;
  /** "current" while still working on it. */
  end: YearMonth | 'current' | null;
}

export interface Publication {
  id?: string;
  title: string;
  url: string;
  description: string;
  published: YearMonth | null;
}

export interface Presentation {
  id?: string;
  title: string;
  url: string;
  description: string;
}

export interface Patent {
  id?: string;
  title: string;
  url: string;
  description: string;
  applicationNumber: string;
  office: string;
  /** Naukri's status code: "a" issued, "p" pending. */
  status: string;
  issued: YearMonth | null;
}

export interface Certification {
  id?: string;
  name: Ref;
  url: string;
  issued: YearMonth | null;
  /** "never" when it doesn't expire. */
  expires: YearMonth | 'never' | null;
}

export interface Language {
  id?: string;
  language: string;
  /** Naukri's entity id for the language, when known. */
  languageRef: string | null;
  /** 1 beginner, 2 proficient, 3 expert. */
  proficiency: 1 | 2 | 3;
  read: boolean;
  write: boolean;
  speak: boolean;
}

/** The top of the profile: name, current city, total experience and current salary. */
export interface Basics {
  name: string;
  city: Tag | null;
  experience: { years: number; months: number };
  currentSalary: Salary | null;
}

/** Naukri's marital status codes, with its labels. */
export const MARITAL_STATUSES = { N: 'Single/unmarried', M: 'Married', W: 'Widowed', D: 'Divorced', S: 'Separated', O: 'Other' } as const;
export type MaritalStatus = keyof typeof MARITAL_STATUSES;

export interface Personal {
  birthDate: string | null;
  gender: 'M' | 'F' | null;
  address: string;
  hometown: string;
  pincode: string;
  maritalStatus: MaritalStatus | null;
}

export interface Sections {
  employments: Employment[];
  itSkills: ItSkill[];
  educations: Education[];
  projects: Project[];
  onlineProfiles: OnlineProfile[];
  workSamples: WorkSample[];
  publications: Publication[];
  presentations: Presentation[];
  patents: Patent[];
  certifications: Certification[];
  languages: Language[];
}

export type SectionName = keyof Sections;

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const ref = (id: unknown, name: unknown): Ref => ({ id: id === null || id === undefined || id === '' || id === 0 ? null : String(id), name: str(name) });
const tag = (v: any): Tag | null => (v && Number(v.id) > 0 ? { id: Number(v.id), name: str(v.value) } : null);
const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));
/** "2024-05-01" → "2024-05"; null for Naukri's empty dates. */
const ym = (date: unknown): YearMonth | null => (/^\d{4}-\d{2}/.test(str(date)) && !str(date).startsWith('0000') ? str(date).slice(0, 7) : null);
/** "05-2024" (certifications) → "2024-05". */
const myToYm = (date: unknown) => (/^\d{2}-\d{4}$/.test(str(date)) ? `${str(date).slice(3)}-${str(date).slice(0, 2)}` : null);
const day = (month: YearMonth) => `${month}-01`;
const withId = <T extends object>(key: string, id: string | undefined, body: T) => (id ? { ...body, [key]: id } : body);

interface Section<T> {
  /** Where Naukri's full profile keeps it. */
  read: string;
  /** The key the save body carries it under. */
  save: string;
  /** The path segment of its DELETE: /profiles/{profileId}/{remove}/{id}. */
  remove: string;
  /** Naukri sends these one item per save; the others go together. */
  onePerSave: boolean;
  parse(raw: any): T;
  build(item: T): Record<string, unknown>;
}

export const SECTIONS: { [K in SectionName]: Section<Sections[K][number]> } = {
  employments: {
    read: 'employments',
    save: 'employments',
    remove: 'employments',
    onePerSave: true,
    parse: (e) => ({
      id: str(e.employmentId),
      current: e.employmentType === 'current',
      designation: ref(e.designationId, e.designation),
      company: ref(e.organizationId, e.organization),
      start: ym(e.startDate) ?? '',
      end: ym(e.endDate),
      description: str(e.jobDescription),
      skills: str(e.keySkills).split(',').map((s) => s.trim()).filter(Boolean),
      experienceType: e.experienceType === 'I' ? 'I' : 'F',
    }),
    build: (e) =>
      withId('employmentId', e.id, {
        employmentType: e.current ? 'current' : 'previous',
        jobDescription: e.description.trim(),
        organization: e.company.name,
        organizationId: e.company.id ?? '',
        designation: e.designation.name,
        designationId: e.designation.id ?? '',
        keySkills: e.skills.join(', '),
        startDate: day(e.start),
        endDate: e.current || !e.end ? '' : day(e.end),
        experienceType: e.experienceType,
      }),
  },
  itSkills: {
    read: 'itskills',
    save: 'itskills',
    remove: 'itskills',
    onePerSave: true,
    parse: (s) => ({
      id: str(s.skillId),
      skill: ref(s.entitySkillId, s.entitySkill || s.skill),
      version: str(s.version),
      lastUsed: num(s.lastUsed?.id ?? s.lastUsed),
      experience: { years: Number(s.experienceTime?.year) || 0, months: Number(s.experienceTime?.month) || 0 },
    }),
    build: (s) =>
      withId('sid', s.id, {
        entitySkill: s.skill.name,
        entitySkillId: s.skill.id ?? '',
        version: s.version,
        // Naukri's form keeps the year as the {id, value} the profile reads it as, and saves it so.
        lastUsed: s.lastUsed ? { id: s.lastUsed, value: s.lastUsed } : { id: '', value: '' },
        experienceTime: { year: s.experience.years, month: s.experience.months },
      }),
  },
  educations: {
    read: 'educations',
    save: 'educations',
    remove: 'educations',
    onePerSave: true,
    parse: (e) => ({
      id: str(e.educationId),
      level: ([1, 2, 3].includes(Number(e.educationType?.id)) ? Number(e.educationType.id) : 1) as 1 | 2 | 3,
      course: tag(e.course) ?? { id: 0, name: '' },
      specialisation: tag(e.specialisation) ?? { id: 0, name: '' },
      institute: ref(e.entityInstitute?.id, e.entityInstitute?.value || e.institute),
      courseType: (['F', 'P', 'C'].includes(e.courseType) ? e.courseType : 'F') as 'F' | 'P' | 'C',
      startYear: num(e.yearOfStart),
      endYear: num(e.yearOfCompletion),
      grade: tag(e.grade),
      marks: str(e.marks),
      primary: Number(e.isPrimary) === 1,
    }),
    build: (e) =>
      withId('educationId', e.id, {
        educationType: { id: e.level, value: { 1: 'UG', 2: 'PG', 3: 'PPG' }[e.level] },
        course: { id: e.course.id, value: e.course.name },
        specialisation: { id: e.specialisation.id, value: e.specialisation.name },
        entityInstitute: { id: e.institute.id ?? '', value: e.institute.name },
        courseType: e.courseType,
        yearOfStart: e.startYear ?? '',
        yearOfCompletion: e.endYear ?? '',
        ...(e.grade ? { grade: { id: e.grade.id, value: e.grade.name }, marks: e.marks } : {}),
        isPrimary: e.primary ? 1 : 0,
      }),
  },
  projects: {
    read: 'projects',
    save: 'projects',
    remove: 'projects',
    onePerSave: true,
    parse: (p) => ({
      id: str(p.projectId),
      title: str(p.projectTitle),
      client: str(p.clientName),
      details: str(p.projectDetails),
      skills: str(p.skills),
      role: str(p.role),
      start: ym(p.startDate) ?? '',
      end: ym(p.endDate),
    }),
    build: (p) =>
      withId('projectId', p.id, {
        projectTitle: p.title,
        clientName: p.client,
        projectDetails: p.details,
        skills: p.skills,
        role: p.role,
        startDate: day(p.start),
        ...(p.end ? { endDate: day(p.end) } : {}),
        eduExpFlag: '',
        eduExpId: '',
      }),
  },
  onlineProfiles: {
    read: 'onlineProfile',
    save: 'onlineProfiles',
    remove: 'onlineProfiles',
    onePerSave: false,
    parse: (o) => ({ id: str(o.id), name: str(o.profile), url: str(o.url), description: str(o.description) }),
    build: (o) => withId('onlineProfileId', o.id, { profile: o.name, url: o.url, description: o.description }),
  },
  workSamples: {
    read: 'workSample',
    save: 'workSamples',
    remove: 'workSamples',
    onePerSave: false,
    parse: (w) => ({
      id: str(w.id),
      title: str(w.title),
      url: str(w.url),
      description: str(w.description),
      start: ym(w.startDate),
      end: str(w.endDate) === '0000-00-00' ? 'current' : ym(w.endDate),
    }),
    build: (w) =>
      withId('workSampleId', w.id, {
        title: w.title,
        url: w.url,
        description: w.description,
        ...(w.start ? { startDate: day(w.start), ...(w.end ? { endDate: w.end === 'current' ? '0000-00-00' : day(w.end) } : {}) } : {}),
      }),
  },
  publications: {
    read: 'publication',
    save: 'publications',
    remove: 'publications',
    onePerSave: false,
    parse: (p) => ({ id: str(p.id), title: str(p.title), url: str(p.url), description: str(p.description), published: ym(p.publishedDate) }),
    build: (p) =>
      withId('publicationId', p.id, { title: p.title, url: p.url, description: p.description, ...(p.published ? { publishedDate: day(p.published) } : {}) }),
  },
  presentations: {
    read: 'presentation',
    save: 'presentations',
    remove: 'presentations',
    onePerSave: false,
    parse: (p) => ({ id: str(p.id), title: str(p.title), url: str(p.url), description: str(p.description) }),
    build: (p) => withId('presentationId', p.id, { title: p.title, url: p.url, description: p.description }),
  },
  patents: {
    read: 'patent',
    save: 'patents',
    remove: 'patents',
    onePerSave: false,
    parse: (p) => ({
      id: str(p.id),
      title: str(p.title),
      url: str(p.url),
      description: str(p.description),
      applicationNumber: str(p.applicationNumber),
      office: str(p.patentOffice),
      status: str(p.status) || 'a',
      issued: ym(p.issueDate),
    }),
    build: (p) =>
      withId('patentId', p.id, {
        title: p.title,
        url: p.url,
        description: p.description,
        applicationNumber: p.applicationNumber,
        patentOffice: p.office,
        status: p.status,
        ...(p.issued ? { issueDate: day(p.issued) } : {}),
      }),
  },
  certifications: {
    read: 'certifications',
    save: 'certifications',
    remove: 'certifications',
    onePerSave: true,
    parse: (c) => ({
      id: str(c.certificationId ?? c.id),
      name: ref(c.entityCertificateId, c.course || c.entityCertificate || c.certificationName),
      url: str(c.url),
      issued: myToYm(c.issueDate) ?? ym(c.issueDate),
      expires: str(c.expiryDate) === '00-0000' ? 'never' : (myToYm(c.expiryDate) ?? ym(c.expiryDate)),
    }),
    build: (c) => {
      const my = (month: YearMonth) => `${month.slice(5)}-${month.slice(0, 4)}`;
      return {
        certificationId: c.id ?? '',
        entityCertificateId: c.name.id,
        course: c.name.id ? null : c.name.name,
        vendorId: null,
        vendor: null,
        bodytype: '',
        completionId: '',
        url: c.url,
        issueDate: c.issued ? my(c.issued) : null,
        expiryDate: c.expires === 'never' ? '00-0000' : c.expires ? my(c.expires) : '',
      };
    },
  },
  languages: {
    read: 'languages',
    save: 'languages',
    remove: 'languages',
    onePerSave: false,
    parse: (l) => {
      const ability: string[] = Array.isArray(l.ability) ? l.ability : [];
      return {
        id: str(l.languageId),
        language: str(l.lang),
        languageRef: l.entityLanguageId ? String(l.entityLanguageId) : null,
        proficiency: ([1, 2, 3].includes(Number(l.proficiency?.id)) ? Number(l.proficiency.id) : 2) as 1 | 2 | 3,
        read: ability.includes('read'),
        write: ability.includes('write'),
        speak: ability.includes('speak'),
      };
    },
    build: (l) =>
      withId('languageId', l.id, {
        lang: l.language,
        ...(l.languageRef ? { entityLanguageId: l.languageRef } : {}),
        proficiency: { id: l.proficiency, value: { 1: 'Beginner', 2: 'Proficient', 3: 'Expert' }[l.proficiency] },
        ability: (['read', 'write', 'speak'] as const).filter((a) => l[a]),
      }),
  },
};

/** Every section's items out of Naukri's full profile. */
export function parseSections(full: any): Sections {
  return Object.fromEntries(
    Object.entries(SECTIONS).map(([name, section]) => {
      const raw = full?.[section.read];
      return [name, Array.isArray(raw) ? raw.map((item: any) => section.parse(item)) : []];
    }),
  ) as unknown as Sections;
}

/**
 * The save bodies for some items of one section (without profileId): one per item for sections
 * Naukri saves singly, else one for all of them.
 */
export function sectionBodies<K extends SectionName>(name: K, items: Sections[K]): Record<string, unknown>[] {
  const section = SECTIONS[name] as Section<Sections[K][number]>;
  const built = items.map((item) => section.build(item));
  return section.onePerSave ? built.map((item) => ({ [section.save]: [item] })) : built.length ? [{ [section.save]: built }] : [];
}

export function parseBasics(full: any): Basics {
  const p = full?.profile?.[0] ?? {};
  const amount = Number(p.absoluteCtc);
  return {
    name: str(p.name),
    city: tag(p.city),
    experience: { years: Number(p.experience?.year) || 0, months: Number(p.experience?.month) || 0 },
    currentSalary: amount > 0 ? { amount, currency: p.currency || 'INR' } : null,
  };
}

export function parsePersonal(full: any): Personal {
  const p = full?.profile?.[0] ?? {};
  return {
    birthDate: /^\d{4}-\d{2}-\d{2}$/.test(str(p.birthDate)) ? str(p.birthDate) : null,
    gender: p.gender === 'M' || p.gender === 'F' ? p.gender : null,
    address: str(p.contactAddress),
    hometown: str(p.mailCity),
    pincode: str(p.pincode),
    maritalStatus: str(p.maritalStatus?.id) in MARITAL_STATUSES ? (str(p.maritalStatus.id) as MaritalStatus) : null,
  };
}

/** Basics and personal details as `profile` fields of a save. */
export function basicsProfile(b: Partial<Basics>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (b.name !== undefined) out.name = b.name;
  if (b.city) out.city = { id: b.city.id, value: b.city.name };
  if (b.experience) out.experience = { year: b.experience.years, month: b.experience.years >= 15 ? '' : b.experience.months };
  if (b.currentSalary) Object.assign(out, { currency: b.currentSalary.currency, absoluteCtc: String(b.currentSalary.amount) });
  return out;
}

export function personalProfile(p: Partial<Personal>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (p.birthDate !== undefined) out.birthDate = p.birthDate ?? '';
  if (p.gender !== undefined) out.gender = p.gender ?? '';
  if (p.address !== undefined) out.contactAddress = p.address.trim();
  if (p.hometown !== undefined) out.mailCity = p.hometown.trim();
  if (p.pincode !== undefined) out.pincode = p.pincode.trim();
  if (p.maritalStatus !== undefined) out.maritalStatus = p.maritalStatus ? { id: p.maritalStatus, value: MARITAL_STATUSES[p.maritalStatus] } : { id: '', value: '' };
  return out;
}
