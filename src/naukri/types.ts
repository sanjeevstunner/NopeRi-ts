import type { BaseSearchParams, Cluster, Job } from '../common/types.ts';

export type { Cluster, Job };

export interface ApplicationStatus {
  statusId: number;
  statusValue: string;
  dateTime: string;
}

export interface ApplicationHistory {
  jobId: string;
  jobTitle: string;
  company: string;
  location: string;
  applyType: string;
  isOpen: boolean;
  arsScore: number;
  starRating: string;
  jobType: string;
  statuses: ApplicationStatus[];
  companyRating: number | null;
  logoPath: string | null;
}

export interface ApplicationDetail extends ApplicationHistory {
  totalApplicants: number;
  applyMatchScore: string | null;
  /** Naukri's per-dimension comparison (industry, experience, location...) vs other applicants. */
  matching: Record<string, unknown>;
}

/** A Naukri taxonomy entry: a city or a designation. */
export interface Tag {
  id: number;
  name: string;
}

export interface Salary {
  /** Per year, e.g. 1500000. */
  amount: number;
  currency: string;
}

export interface ProfileFields {
  headline?: string;
  name?: string;
  summary?: string;
  keySkills?: string[];
  /** Designations, at most 3. */
  desiredRoles?: Tag[];
  /** Cities, at most 10. */
  preferredLocations?: Tag[];
  expectedSalary?: Salary;
  /** Key of NOTICE_PERIODS. */
  noticePeriodId?: number;
}

/** The profile fields PATCH /profile can change, as they are now. */
export interface EditableProfile {
  headline: string;
  summary: string;
  keySkills: string[];
  desiredRoles: Tag[];
  preferredLocations: Tag[];
  expectedSalary: Salary | null;
  noticePeriodId: number | null;
}

export type TaxonomyType = 'location' | 'designation';

export interface SearchParams extends BaseSearchParams {
  jobAge?: number;
  latLong?: string;
}

export interface SearchResult {
  jobs: Job[];
  total: number;
  /** Filter groups for this search, keyed by cluster key. Only keys in FILTER_PARAMS are returned. */
  clusters: Record<string, Cluster[]>;
  clusterOrder: string[];
}

export interface HistoryParams {
  pageSize?: number;
  days?: number;
  pageNumber?: number;
  mobile?: boolean;
}

export type ApplySource = 'recommended' | 'search';

export interface ApplyParams {
  jobId: string;
  mandatorySkills?: string[];
  optionalSkills?: string[];
  sid?: string;
  source?: ApplySource;
  /** Questionnaire answers keyed by questionId. Text answers are strings, option answers are arrays of option labels, e.g. ["Yes"]. */
  answers?: Record<string, string | string[]>;
}

/**
 * A questionnaire question. Answer text questions with a string (Naukri caps it at 100 characters),
 * choice questions with `[optionLabel]` and multi questions with several labels: the browser sends labels, not keys.
 */
export interface Question {
  id: string;
  text: string;
  type: 'text' | 'choice' | 'multi';
  /** Option key → label; empty for text questions. */
  options: Record<string, string>;
  required: boolean;
  /** Naukri fills it from the Naukri profile; leave it out of `answers`. */
  skippable: boolean;
  /** What Naukri would fill in, e.g. ["750000"]. */
  prefill: string[];
}

export interface JobSkills {
  mandatory: string[];
  optional: string[];
}
