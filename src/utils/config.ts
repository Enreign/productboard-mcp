import { readFileSync } from 'fs';
import { resolve } from 'path';
import { AuthenticationType } from '@auth/types.js';
import { LogLevel } from './logger.js';
import { SamplingConfiguration } from '@core/types.js';

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

export class ConfigManager {
  private config: Config;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): Config {
    
    const defaults = this.loadDefaults();
    const envConfig = this.fromEnv();
    
    return this.mergeConfigs(defaults, envConfig);
  }

  private loadDefaults(): Partial<Config> {
    try {
      const configPath = resolve(process.cwd(), 'config', 'default.json');
      const configFile = readFileSync(configPath, 'utf-8');
      return JSON.parse(configFile) as Partial<Config>;
    } catch {
      return {};
    }
  }

  private fromEnv(): Config {
    const env = process.env;
    
    return {
      server: {
        port: parseInt(env.MCP_SERVER_PORT || '3000'),
        host: env.MCP_SERVER_HOST || 'localhost',
        timeout: parseInt(env.MCP_SERVER_TIMEOUT || '30000'),
      },
      auth: {
        type: (env.PRODUCTBOARD_AUTH_TYPE as AuthenticationType) || AuthenticationType.BEARER_TOKEN,
        token: env.PRODUCTBOARD_API_TOKEN,
        clientId: env.PRODUCTBOARD_OAUTH_CLIENT_ID,
        clientSecret: env.PRODUCTBOARD_OAUTH_CLIENT_SECRET,
        redirectUri: env.PRODUCTBOARD_OAUTH_REDIRECT_URI,
      },
      api: {
        baseUrl: env.PRODUCTBOARD_API_BASE_URL || 'https://api.productboard.com/v1',
        timeout: parseInt(env.PRODUCTBOARD_API_TIMEOUT || '10000'),
        retryAttempts: parseInt(env.API_RETRY_ATTEMPTS || '3'),
        retryDelay: parseInt(env.API_RETRY_DELAY || '1000'),
      },
      rateLimit: {
        global: parseInt(env.RATE_LIMIT_GLOBAL || '100'),
        windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS || '60000'),
      },
      cache: {
        enabled: env.CACHE_ENABLED === 'true',
        ttl: parseInt(env.CACHE_TTL || '300'),
        maxSize: parseInt(env.CACHE_MAX_SIZE || '100'),
      },
      logLevel: (env.LOG_LEVEL as LogLevel) || 'info',
      logPretty: env.LOG_PRETTY === 'true',
      nodeEnv: env.NODE_ENV || 'development',
    };
  }

  private mergeConfigs(defaults: Partial<Config>, envConfig: Config): Config {
    return {
      server: { ...defaults.server, ...envConfig.server },
      auth: { ...defaults.auth, ...envConfig.auth },
      api: { ...defaults.api, ...envConfig.api },
      rateLimit: { ...defaults.rateLimit, ...envConfig.rateLimit },
      cache: { ...defaults.cache, ...envConfig.cache },
      sampling: { ...defaults.sampling, ...envConfig.sampling },
      resources: { 
        enabled: envConfig.resources?.enabled ?? defaults.resources?.enabled ?? false,
        refreshInterval: envConfig.resources?.refreshInterval ?? defaults.resources?.refreshInterval ?? 300000,
      },
      prompts: { 
        enabled: envConfig.prompts?.enabled ?? defaults.prompts?.enabled ?? false,
        templatesPath: envConfig.prompts?.templatesPath ?? defaults.prompts?.templatesPath ?? './prompts',
      },
      logLevel: envConfig.logLevel || defaults.logLevel || 'info',
      logPretty: envConfig.logPretty ?? defaults.logPretty ?? true,
      nodeEnv: envConfig.nodeEnv || defaults.nodeEnv || 'development',
    };
  }

  get(): Config {
    return { ...this.config };
  }

  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (this.config.auth.type === AuthenticationType.BEARER_TOKEN && !this.config.auth.token) {
      errors.push('Bearer token authentication requires PRODUCTBOARD_API_TOKEN');
    }
    
    if (this.config.auth.type === AuthenticationType.OAUTH2) {
      if (!this.config.auth.clientId) {
        errors.push('OAuth2 authentication requires PRODUCTBOARD_OAUTH_CLIENT_ID');
      }
      if (!this.config.auth.clientSecret) {
        errors.push('OAuth2 authentication requires PRODUCTBOARD_OAUTH_CLIENT_SECRET');
      }
    }
    
    if (this.config.server.port < 1 || this.config.server.port > 65535) {
      errors.push('Server port must be between 1 and 65535');
    }
    
    if (this.config.api.retryAttempts < 0) {
      errors.push('API retry attempts must be non-negative');
    }
    
    if (this.config.rateLimit.global < 1) {
      errors.push('Global rate limit must be at least 1');
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  update(updates: Partial<Config>): void {
    this.config = this.mergeConfigs(this.config, updates as Config);
  }
}