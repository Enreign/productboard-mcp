export interface CacheOptions {
  enabled: boolean;
  ttl: number;
  maxSize: number;
}

export interface CacheableRequest {
  tool: string;
  method: string;
  params?: unknown;
}

export interface Schema {
  type?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  additionalProperties?: boolean | Schema;
  [key: string]: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
  value?: unknown;
}

export type ValidatorFunction = (value: unknown, schema: Schema) => ValidationResult;
