import { NaukriUpstreamError } from '../naukri/errors.ts';
import { ensureOk, readJson, type Http } from '../naukri/http.ts';
import type { GulfAuth } from './auth.ts';
import { URLS } from './constants.ts';

export interface GulfProfileFields {
  headline?: string;
  summary?: string;
}

/** Profile reads, headline/summary edits and the attached CV. */
export class GulfProfile {
  readonly #http: Http;
  readonly #auth: GulfAuth;

  constructor(http: Http, auth: GulfAuth) {
    this.#http = http;
    this.#auth = auth;
  }

  /** Everything on the profile (`fullProfile.myCV`: basicDetails, cvHeadline, profileSummary, workExperience, keySkills, ...). */
  async full(): Promise<Record<string, any>> {
    const res = await this.#http.get(URLS.fullProfile, { headers: await this.#auth.authHeaders() });
    return readJson(res, 'Fetch profile');
  }

  /** One section, e.g. `cvHeadline`, `profileSummary`, `cvMetadata`, `basicDetails`, `mnjWidget`. */
  async section(section: string): Promise<Record<string, any>> {
    const res = await this.#http.get(URLS.profile, { headers: await this.#auth.authHeaders(), params: { section } });
    return readJson(res, `Fetch profile section ${section}`);
  }

  /**
   * Updates the CV headline and/or summary via `POST /user/self/section/<name>`.
   * ponytail: request body mirrors the GET shape ({ cvHeadline: { text } }); not yet verified against a live write.
   */
  async update({ headline, summary }: GulfProfileFields) {
    const post = async (name: string, body: unknown) =>
      readJson(
        await this.#http.post(`${URLS.profile}/section/${name}`, { headers: await this.#auth.authHeaders(), json: body as object }),
        `Update ${name}`,
      );
    const response: Record<string, unknown> = {};
    if (headline !== undefined) response.cvHeadline = await post('cvHeadline', { cvHeadline: { text: headline } });
    if (summary !== undefined) response.profileSummary = await post('profileSummary', { profileSummary: { text: summary } });
    return { response };
  }

  /** The CV attached to the profile. */
  async currentResume(): Promise<{ file: Buffer; filename: string }> {
    const headers = await this.#auth.authHeaders({ systemid: '123' });
    const res = ensureOk(await this.#http.get(URLS.cvAttachment, { headers, params: { systemId: 123, appId: 205 } }), 'Download CV');
    if (res.body.subarray(0, 5).toString() !== '%PDF-') throw new NaukriUpstreamError('Downloaded CV is not a PDF', res.statusCode);
    return { file: res.body, filename: 'cv.pdf' };
  }
}
