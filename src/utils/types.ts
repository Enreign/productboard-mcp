import { AuthenticationType } from '@auth/types.js';
import { SamplingConfiguration } from '@core/types.js';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LoggerConfig {
  level: LogLevel;
  pretty?: boolean;
  name?: string;
}

export interface RetryOptions {
  maxAttempts: number;
  backoffStrategy: 'exponential' | 'linear';
  initialDelay: number;
  maxDelay: number;
  retryCondition?: (error: unknown) => boolean;
}

export interface ServerConfig {
  port: number;
  host: string;
  timeout: number;
}

export interface AuthConfig {
  type: AuthenticationType;
  token?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
}

export interface APIConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface RateLimitConfig {
  global: number;
  windowMs: number;
  perTool?: Record<string, number>;
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number;
  maxSize: number;
}

export interface ResourcesConfig {
  enabled: boolean;
  refreshInterval: number;
}

export interface PromptsConfig {
  enabled: boolean;
  templatesPath: string;
}

export interface Config {
  server: ServerConfig;
  auth: AuthConfig;
  api: APIConfig;
  rateLimit: RateLimitConfig;
  cache: CacheConfig;
  sampling?: SamplingConfiguration;
  resources?: ResourcesConfig;
  prompts?: PromptsConfig;
  logLevel: LogLevel;
  logPretty: boolean;
  nodeEnv: string;
}
