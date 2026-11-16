/** A job in the shape every site's parser maps to. */
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
  /** Naukri's diversityTagText, e.g. "Prefers women candidates". */
  diversityTag?: string;
}

/** One value of a search filter group, as returned in a search result's `clusters`. */
export interface Cluster {
  id: string;
  count: number;
  label: string;
}

/** Search parameters every site supports. */
export interface BaseSearchParams {
  keyword: string;
  location?: string;
  page?: number;
  experience?: number;
  resultsPerPage?: number;
  /** Filters keyed by cluster key (e.g. `wfhType: ['2']`); ids come from a previous result's `clusters`. */
  filters?: Record<string, string[]>;
}

/** A resume file as stored on a profile. */
export interface Resume {
  file: Buffer;
  filename: string;
}
