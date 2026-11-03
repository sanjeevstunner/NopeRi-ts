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
  /** Questionnaire answers keyed by questionId. Text answers are strings, option answers are arrays of option keys. */
  answers?: Record<string, string | string[]>;
}
