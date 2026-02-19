import { readFileSync } from 'fs';
import { resolve } from 'path';
import { AuthenticationType } from '@auth/types.js';
import { LogLevel } from './types.js';
import { Config } from './types.js';
export { Config };

export class ConfigManager {
  private config: Config;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): Config {
    const fileConfig = this.loadDefaults();
    const envConfig = this.fromEnv();

    return this.mergeConfigs(fileConfig, envConfig);
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

  private fromEnv(): Partial<Config> {
    const env = process.env;

    const server: Partial<Config['server']> = {};
    if (env.MCP_SERVER_PORT) server.port = parseInt(env.MCP_SERVER_PORT);
    if (env.MCP_SERVER_HOST) server.host = env.MCP_SERVER_HOST;
    if (env.MCP_SERVER_TIMEOUT) server.timeout = parseInt(env.MCP_SERVER_TIMEOUT);

    const auth: Partial<Config['auth']> = {};
    if (env.PRODUCTBOARD_AUTH_TYPE) auth.type = env.PRODUCTBOARD_AUTH_TYPE as AuthenticationType;
    if (env.PRODUCTBOARD_API_TOKEN) auth.token = env.PRODUCTBOARD_API_TOKEN;
    if (env.PRODUCTBOARD_OAUTH_CLIENT_ID) auth.clientId = env.PRODUCTBOARD_OAUTH_CLIENT_ID;
    if (env.PRODUCTBOARD_OAUTH_CLIENT_SECRET) auth.clientSecret = env.PRODUCTBOARD_OAUTH_CLIENT_SECRET;
    if (env.PRODUCTBOARD_OAUTH_REDIRECT_URI) auth.redirectUri = env.PRODUCTBOARD_OAUTH_REDIRECT_URI;

    const api: Partial<Config['api']> = {};
    if (env.PRODUCTBOARD_API_BASE_URL) api.baseUrl = env.PRODUCTBOARD_API_BASE_URL;
    if (env.PRODUCTBOARD_API_TIMEOUT) api.timeout = parseInt(env.PRODUCTBOARD_API_TIMEOUT);
    if (env.API_RETRY_ATTEMPTS) api.retryAttempts = parseInt(env.API_RETRY_ATTEMPTS);
    if (env.API_RETRY_DELAY) api.retryDelay = parseInt(env.API_RETRY_DELAY);

    const rateLimit: Partial<Config['rateLimit']> = {};
    if (env.RATE_LIMIT_GLOBAL) rateLimit.global = parseInt(env.RATE_LIMIT_GLOBAL);
    if (env.RATE_LIMIT_WINDOW_MS) rateLimit.windowMs = parseInt(env.RATE_LIMIT_WINDOW_MS);

    const cache: Partial<Config['cache']> = {};
    if (env.CACHE_ENABLED) cache.enabled = env.CACHE_ENABLED === 'true';
    if (env.CACHE_TTL) cache.ttl = parseInt(env.CACHE_TTL);
    if (env.CACHE_MAX_SIZE) cache.maxSize = parseInt(env.CACHE_MAX_SIZE);

    const result: Partial<Config> = {};
    if (Object.keys(server).length > 0) result.server = server as Config['server'];
    if (Object.keys(auth).length > 0) result.auth = auth as Config['auth'];
    if (Object.keys(api).length > 0) result.api = api as Config['api'];
    if (Object.keys(rateLimit).length > 0) result.rateLimit = rateLimit as Config['rateLimit'];
    if (Object.keys(cache).length > 0) result.cache = cache as Config['cache'];
    if (env.LOG_LEVEL) result.logLevel = env.LOG_LEVEL as LogLevel;
    if (env.LOG_PRETTY) result.logPretty = env.LOG_PRETTY === 'true';
    if (env.NODE_ENV) result.nodeEnv = env.NODE_ENV;

    return result;
  }

  private mergeConfigs(fileConfig: Partial<Config>, envConfig: Partial<Config>): Config {
    // Base defaults < file config < env config (env has highest priority)
    const baseDefaults: Config = {
      server: { port: 3000, host: 'localhost', timeout: 30000 },
      auth: { type: AuthenticationType.BEARER_TOKEN },
      api: { baseUrl: 'https://api.productboard.com/v2', timeout: 10000, retryAttempts: 3, retryDelay: 1000 },
      rateLimit: { global: 100, windowMs: 60000 },
      cache: { enabled: false, ttl: 300, maxSize: 100 },
      logLevel: 'info',
      logPretty: true,
      nodeEnv: 'development',
    };

    return {
      server: { ...baseDefaults.server, ...fileConfig.server, ...envConfig.server },
      auth: { ...baseDefaults.auth, ...fileConfig.auth, ...envConfig.auth },
      api: { ...baseDefaults.api, ...fileConfig.api, ...envConfig.api },
      rateLimit: { ...baseDefaults.rateLimit, ...fileConfig.rateLimit, ...envConfig.rateLimit },
      cache: { ...baseDefaults.cache, ...fileConfig.cache, ...envConfig.cache },
      sampling: { ...fileConfig.sampling, ...envConfig.sampling },
      resources: {
        enabled: envConfig.resources?.enabled ?? fileConfig.resources?.enabled ?? false,
        refreshInterval: envConfig.resources?.refreshInterval ?? fileConfig.resources?.refreshInterval ?? 300000,
      },
      prompts: {
        enabled: envConfig.prompts?.enabled ?? fileConfig.prompts?.enabled ?? false,
        templatesPath: envConfig.prompts?.templatesPath ?? fileConfig.prompts?.templatesPath ?? './prompts',
      },
      logLevel: envConfig.logLevel || fileConfig.logLevel || baseDefaults.logLevel,
      logPretty: envConfig.logPretty ?? fileConfig.logPretty ?? baseDefaults.logPretty,
      nodeEnv: envConfig.nodeEnv || fileConfig.nodeEnv || baseDefaults.nodeEnv,
    };
  }

  get(): Config {
    return JSON.parse(JSON.stringify(this.config)) as Config;
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
    this.config = this.mergeConfigs(this.config, updates);
  }
}