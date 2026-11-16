export interface Credentials {
  username: string;
  password: string;
}

/** Treat a token as expired this early, so a call already in flight doesn't 401. */
const EXPIRY_MARGIN_MS = 60_000;

/**
 * Login state shared by the Naukri and NaukriGulf clients: both hand out short-lived JWTs.
 * Subclasses implement `login()` and call `loggedIn(token)` once they hold a token;
 * `ensureLoggedIn()` logs in again when there is no token or it is about to expire.
 */
export abstract class TokenAuth {
  #loginTime?: Date;
  #expiresAt?: number;
  #pendingLogin?: Promise<void>;

  abstract login(): Promise<void>;

  get status() {
    return { loggedIn: this.#valid(), loginTime: this.#loginTime?.toISOString() ?? null };
  }

  /** Records a successful login. A token that isn't a readable JWT is assumed not to expire. */
  protected loggedIn(token: string | undefined): void {
    this.#loginTime = new Date();
    this.#expiresAt = token ? jwtExpiry(token) : undefined;
  }

  protected ensureLoggedIn(): Promise<void> {
    if (this.#valid()) return Promise.resolve();
    // Concurrent requests share one login instead of each starting their own.
    this.#pendingLogin ??= this.login().finally(() => (this.#pendingLogin = undefined));
    return this.#pendingLogin;
  }

  #valid(): boolean {
    return Boolean(this.#loginTime) && (this.#expiresAt === undefined || Date.now() < this.#expiresAt - EXPIRY_MARGIN_MS);
  }
}

/** `exp` of a JWT in ms, or undefined if the token isn't a readable JWT. */
export function jwtExpiry(token: string): number | undefined {
  try {
    const { exp } = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString());
    return typeof exp === 'number' ? exp * 1000 : undefined;
  } catch {
    return undefined;
  }
}
