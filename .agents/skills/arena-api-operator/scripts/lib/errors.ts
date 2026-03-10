export class ArenaError extends Error {
  declare cause?: unknown;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = new.target.name;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

export class ArenaConfigError extends ArenaError {}

export class ArenaValidationError extends ArenaError {
  readonly issues: string[];

  constructor(message: string, issues: string[]) {
    super(message);
    this.issues = issues;
  }
}

export class ArenaHttpError extends ArenaError {
  readonly status: number;
  readonly payload?: unknown;
  readonly retryAfter?: number | null;

  constructor(message: string, status: number, payload?: unknown, retryAfter?: number | null) {
    super(message);
    this.status = status;
    this.payload = payload;
    this.retryAfter = retryAfter ?? null;
  }
}
