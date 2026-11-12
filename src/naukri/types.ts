export interface Job {
  jobId: string;
  title: string;
  company: string;
  location: string;
  experience: string;
  salary: string;
  postedDate: string;
  applyLink: string;
  description: string;
  tags: string[];
}

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

export interface ProfileFields {
  headline?: string;
  name?: string;
  summary?: string;
}

export interface SearchParams {
  keyword: string;
  location?: string;
  page?: number;
  jobAge?: number;
  experience?: number;
  resultsPerPage?: number;
  latLong?: string;
  /** Naukri filters keyed by cluster key (e.g. `wfhType: ['2']`); ids come from a previous result's `clusters`. */
  filters?: Record<string, string[]>;
}

export interface Cluster {
  id: string;
  count: number;
  label: string;
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
