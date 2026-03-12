export class ProductboardAPIError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly details?: unknown;
  public readonly cause?: Error;

  constructor(message: string, code: string, cause?: Error, statusCode?: number, details?: unknown) {
    super(message);
    this.name = 'ProductboardAPIError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.cause = cause;

    Object.setPrototypeOf(this, ProductboardAPIError.prototype);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      cause: this.cause?.message,
    };
  }
}

export class APIValidationError extends ProductboardAPIError {
  constructor(message: string, details?: unknown) {
    super(message, 'API_VALIDATION_ERROR', undefined, 400, details);
    this.name = 'APIValidationError';
    Object.setPrototypeOf(this, APIValidationError.prototype);
  }
}

export class APIAuthenticationError extends ProductboardAPIError {
  constructor(message: string) {
    super(message, 'API_AUTHENTICATION_ERROR', undefined, 401);
    this.name = 'APIAuthenticationError';
    Object.setPrototypeOf(this, APIAuthenticationError.prototype);
  }
}

export class APIAuthorizationError extends ProductboardAPIError {
  constructor(message: string) {
    super(message, 'API_AUTHORIZATION_ERROR', undefined, 403);
    this.name = 'APIAuthorizationError';
    Object.setPrototypeOf(this, APIAuthorizationError.prototype);
  }
}

export class APINotFoundError extends ProductboardAPIError {
  constructor(message: string, resource?: string) {
    super(message, 'API_NOT_FOUND_ERROR', undefined, 404, { resource });
    this.name = 'APINotFoundError';
    Object.setPrototypeOf(this, APINotFoundError.prototype);
  }
}

export class APIRateLimitError extends ProductboardAPIError {
  public readonly retryAfter?: number;

  constructor(message: string, retryAfter?: number) {
    super(message, 'API_RATE_LIMIT_ERROR', undefined, 429, { retryAfter });
    this.name = 'APIRateLimitError';
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, APIRateLimitError.prototype);
  }
}

export class APIServerError extends ProductboardAPIError {
  constructor(message: string, statusCode: number = 500) {
    super(message, 'API_SERVER_ERROR', undefined, statusCode);
    this.name = 'APIServerError';
    Object.setPrototypeOf(this, APIServerError.prototype);
  }
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof APIRateLimitError) {
    return true;
  }
  if (error instanceof APIServerError && error.statusCode && error.statusCode >= 500) {
    return true;
  }
  if (error instanceof Error && error.message.includes('ECONNRESET')) {
    return true;
  }
  if (error instanceof Error && error.message.includes('ETIMEDOUT')) {
    return true;
  }
  return false;
}