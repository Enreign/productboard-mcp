import { jest } from '@jest/globals';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ConfigManager, Config } from '@utils/config.js';
import { AuthenticationType } from '@auth/types.js';
import { LogLevel } from '@utils/logger.js';

const mockReadFileSync = jest.mocked(readFileSync);
const mockResolve = jest.mocked(resolve);

// Mock fs and path modules
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
}));

jest.mock('path', () => ({
  resolve: jest.fn(),
}));

describe('ConfigManager', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };
    
    // Clear environment variables
    delete process.env.MCP_SERVER_PORT;
    delete process.env.MCP_SERVER_HOST;
    delete process.env.MCP_SERVER_TIMEOUT;
    delete process.env.PRODUCTBOARD_AUTH_TYPE;
    delete process.env.PRODUCTBOARD_API_TOKEN;
    delete process.env.PRODUCTBOARD_OAUTH_CLIENT_ID;
    delete process.env.PRODUCTBOARD_OAUTH_CLIENT_SECRET;
    delete process.env.PRODUCTBOARD_OAUTH_REDIRECT_URI;
    delete process.env.PRODUCTBOARD_API_BASE_URL;
    delete process.env.PRODUCTBOARD_API_TIMEOUT;
    delete process.env.API_RETRY_ATTEMPTS;
    delete process.env.API_RETRY_DELAY;
    delete process.env.RATE_LIMIT_GLOBAL;
    delete process.env.RATE_LIMIT_WINDOW_MS;
    delete process.env.CACHE_ENABLED;
    delete process.env.CACHE_TTL;
    delete process.env.CACHE_MAX_SIZE;
    delete process.env.LOG_LEVEL;
    delete process.env.LOG_PRETTY;
    delete process.env.NODE_ENV;

    // Reset mocks
    jest.clearAllMocks();
    
    // Setup default mocks
    mockResolve.mockReturnValue('/mock/config/default.json');
    mockReadFileSync.mockImplementation(() => {
      throw new Error('File not found');
    });
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('constructor and loadConfig', () => {
    it('should initialize with default configuration when no files or env vars exist', () => {
      const configManager = new ConfigManager();
      const config = configManager.get();

      expect(config.server.port).toBe(3000);
      expect(config.server.host).toBe('localhost');
      expect(config.server.timeout).toBe(30000);
      expect(config.auth.type).toBe(AuthenticationType.BEARER_TOKEN);
      expect(config.api.baseUrl).toBe('https://api.productboard.com/v1');
      expect(config.logLevel).toBe('info');
      expect(config.nodeEnv).toBe('development');
    });

    it('should load configuration from default.json file when available', () => {
      const defaultConfig = {
        server: {
          port: 8080,
          host: '0.0.0.0',
          timeout: 60000,
        },
        auth: {
          type: 'oauth2',
        },
        api: {
          baseUrl: 'https://custom.api.com/v2',
          timeout: 20000,
          retryAttempts: 5,
          retryDelay: 2000,
        },
        rateLimit: {
          global: 200,
          windowMs: 120000,
        },
        cache: {
          enabled: false,
          ttl: 600,
          maxSize: 500,
        },
        logLevel: 'debug',
        logPretty: false,
        nodeEnv: 'production',
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(defaultConfig));

      const configManager = new ConfigManager();
      const config = configManager.get();

      expect(config.server.port).toBe(8080);
      expect(config.server.host).toBe('0.0.0.0');
      expect(config.auth.type).toBe(AuthenticationType.OAUTH2);
      expect(config.api.baseUrl).toBe('https://custom.api.com/v2');
      expect(config.logLevel).toBe('debug');
      expect(config.nodeEnv).toBe('production');
    });

    it('should handle corrupted default.json file gracefully', () => {
      mockReadFileSync.mockReturnValue('{ invalid json }');

      // Should not throw but fall back to defaults
      const configManager = new ConfigManager();
      const config = configManager.get();

      expect(config.server.port).toBe(3000);
      expect(config.logLevel).toBe('info');
    });

    it('should merge default file config with environment variables', () => {
      const defaultConfig = {
        server: { port: 8080, host: '0.0.0.0' },
        logLevel: 'debug',
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(defaultConfig));

      process.env.MCP_SERVER_PORT = '9000';
      process.env.LOG_LEVEL = 'warn';
      process.env.PRODUCTBOARD_API_TOKEN = 'env-token';

      const configManager = new ConfigManager();
      const config = configManager.get();

      // Environment should override file
      expect(config.server.port).toBe(9000);
      expect(config.logLevel).toBe('warn');
      expect(config.auth.token).toBe('env-token');
      // File values should persist where no env override exists
      expect(config.server.host).toBe('0.0.0.0');
    });
  });

  describe('environment variable parsing', () => {
    describe('server configuration', () => {
      it('should parse server environment variables correctly', () => {
        process.env.MCP_SERVER_PORT = '4000';
        process.env.MCP_SERVER_HOST = '127.0.0.1';
        process.env.MCP_SERVER_TIMEOUT = '45000';

        const configManager = new ConfigManager();
        const config = configManager.get();

        expect(config.server.port).toBe(4000);
        expect(config.server.host).toBe('127.0.0.1');
        expect(config.server.timeout).toBe(45000);
      });

      it('should handle invalid port numbers gracefully', () => {
        process.env.MCP_SERVER_PORT = 'invalid';

        const configManager = new ConfigManager();
        const config = configManager.get();

        expect(config.server.port).toBe(NaN);
      });

      it('should handle empty string environment variables', () => {
        process.env.MCP_SERVER_PORT = '';
        process.env.MCP_SERVER_HOST = '';

        const configManager = new ConfigManager();
        const config = configManager.get();

        expect(config.server.port).toBe(3000); // Should use default
        expect(config.server.host).toBe('localhost'); // Should use default
      });
    });

    describe('authentication configuration', () => {
      it('should configure Bearer token authentication', () => {
        process.env.PRODUCTBOARD_AUTH_TYPE = 'bearer';
        process.env.PRODUCTBOARD_API_TOKEN = 'test-bearer-token';

        const configManager = new ConfigManager();
        const config = configManager.get();

        expect(config.auth.type).toBe(AuthenticationType.BEARER_TOKEN);
        expect(config.auth.token).toBe('test-bearer-token');
        expect(config.auth.clientId).toBeUndefined();
        expect(config.auth.clientSecret).toBeUndefined();
      });

      it('should configure OAuth2 authentication', () => {
        process.env.PRODUCTBOARD_AUTH_TYPE = 'oauth2';
        process.env.PRODUCTBOARD_OAUTH_CLIENT_ID = 'test-client-id';
        process.env.PRODUCTBOARD_OAUTH_CLIENT_SECRET = 'test-client-secret';
        process.env.PRODUCTBOARD_OAUTH_REDIRECT_URI = 'https://example.com/callback';

        const configManager = new ConfigManager();
        const config = configManager.get();

        expect(config.auth.type).toBe(AuthenticationType.OAUTH2);
        expect(config.auth.clientId).toBe('test-client-id');
        expect(config.auth.clientSecret).toBe('test-client-secret');
        expect(config.auth.redirectUri).toBe('https://example.com/callback');
      });

      it('should handle missing auth type with default', () => {
        const configManager = new ConfigManager();
        const config = configManager.get();

        expect(config.auth.type).toBe(AuthenticationType.BEARER_TOKEN);
      });
    });

    describe('API configuration', () => {
      it('should parse API environment variables correctly', () => {
        process.env.PRODUCTBOARD_API_BASE_URL = 'https://custom.api.com/v2';
        process.env.PRODUCTBOARD_API_TIMEOUT = '15000';
        process.env.API_RETRY_ATTEMPTS = '5';
        process.env.API_RETRY_DELAY = '2500';

        const configManager = new ConfigManager();
        const config = configManager.get();

        expect(config.api.baseUrl).toBe('https://custom.api.com/v2');
        expect(config.api.timeout).toBe(15000);
        expect(config.api.retryAttempts).toBe(5);
        expect(config.api.retryDelay).toBe(2500);
      });

      it('should use default API values when env vars are not set', () => {
        const configManager = new ConfigManager();
        const config = configManager.get();

        expect(config.api.baseUrl).toBe('https://api.productboard.com/v1');
        expect(config.api.timeout).toBe(10000);
        expect(config.api.retryAttempts).toBe(3);
        expect(config.api.retryDelay).toBe(1000);
      });
    });

    describe('rate limiting configuration', () => {
      it('should parse rate limit environment variables', () => {
        process.env.RATE_LIMIT_GLOBAL = '500';
        process.env.RATE_LIMIT_WINDOW_MS = '120000';

        const configManager = new ConfigManager();
        const config = configManager.get();

        expect(config.rateLimit.global).toBe(500);
        expect(config.rateLimit.windowMs).toBe(120000);
      });

      it('should use defaults for rate limiting', () => {
        const configManager = new ConfigManager();
        const config = configManager.get();

        expect(config.rateLimit.global).toBe(100);
        expect(config.rateLimit.windowMs).toBe(60000);
      });
    });

    describe('cache configuration', () => {
      it('should parse cache environment variables', () => {
        process.env.CACHE_ENABLED = 'true';
        process.env.CACHE_TTL = '600';
        process.env.CACHE_MAX_SIZE = '1000';

        const configManager = new ConfigManager();
        const config = configManager.get();

        expect(config.cache.enabled).toBe(true);
        expect(config.cache.ttl).toBe(600);
        expect(config.cache.maxSize).toBe(1000);
      });

      it('should handle false cache enabled correctly', () => {
        process.env.CACHE_ENABLED = 'false';

        const configManager = new ConfigManager();
        const config = configManager.get();

        expect(config.cache.enabled).toBe(false);
      });

      it('should handle non-boolean cache enabled values', () => {
        process.env.CACHE_ENABLED = 'invalid';

        const configManager = new ConfigManager();
        const config = configManager.get();

        expect(config.cache.enabled).toBe(false);
      });
    });

    describe('logging configuration', () => {
      it('should parse logging environment variables', () => {
        process.env.LOG_LEVEL = 'error';
        process.env.LOG_PRETTY = 'true';

        const configManager = new ConfigManager();
        const config = configManager.get();

        expect(config.logLevel).toBe('error');
        expect(config.logPretty).toBe(true);
      });

      it('should handle invalid log levels gracefully', () => {
        process.env.LOG_LEVEL = 'invalid';

        const configManager = new ConfigManager();
        const config = configManager.get();

        expect(config.logLevel).toBe('invalid' as LogLevel); // Type system allows this
      });

      it('should handle log pretty boolean parsing', () => {
        process.env.LOG_PRETTY = 'false';

        const configManager = new ConfigManager();
        const config = configManager.get();

        expect(config.logPretty).toBe(false);
      });
    });

    describe('node environment', () => {
      it('should parse NODE_ENV correctly', () => {
        process.env.NODE_ENV = 'staging';

        const configManager = new ConfigManager();
        const config = configManager.get();

        expect(config.nodeEnv).toBe('staging');
      });

      it('should default to development', () => {
        const configManager = new ConfigManager();
        const config = configManager.get();

        expect(config.nodeEnv).toBe('development');
      });
    });
  });

  describe('configuration merging', () => {
    it('should prioritize environment variables over default file values', () => {
      const defaultConfig = {
        server: { port: 8080, host: '0.0.0.0', timeout: 60000 },
        auth: { type: 'oauth2', token: 'file-token' },
        logLevel: 'debug',
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(defaultConfig));

      process.env.MCP_SERVER_PORT = '9000';
      process.env.PRODUCTBOARD_API_TOKEN = 'env-token';
      process.env.LOG_LEVEL = 'warn';

      const configManager = new ConfigManager();
      const config = configManager.get();

      expect(config.server.port).toBe(9000); // From env
      expect(config.server.host).toBe('0.0.0.0'); // From file
      expect(config.server.timeout).toBe(60000); // From file
      expect(config.auth.token).toBe('env-token'); // From env
      expect(config.logLevel).toBe('warn'); // From env
    });

    it('should handle complex nested merging for resources and prompts', () => {
      const defaultConfig = {
        resources: {
          enabled: true,
          refreshInterval: 600000,
        },
        prompts: {
          enabled: false,
          templatesPath: './default-prompts',
        },
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(defaultConfig));

      const configManager = new ConfigManager();
      const config = configManager.get();

      expect(config.resources).toEqual({
        enabled: true,
        refreshInterval: 600000,
      });
      expect(config.prompts).toEqual({
        enabled: false,
        templatesPath: './default-prompts',
      });
    });

    it('should provide default values for resources and prompts when not in file', () => {
      const configManager = new ConfigManager();
      const config = configManager.get();

      expect(config.resources).toEqual({
        enabled: false,
        refreshInterval: 300000,
      });
      expect(config.prompts).toEqual({
        enabled: false,
        templatesPath: './prompts',
      });
    });
  });

  describe('validate method', () => {
    describe('authentication validation', () => {
      it('should pass validation with valid Bearer token configuration', () => {
        process.env.PRODUCTBOARD_AUTH_TYPE = 'bearer';
        process.env.PRODUCTBOARD_API_TOKEN = 'valid-token';

        const configManager = new ConfigManager();
        const result = configManager.validate();

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should fail validation when Bearer token is missing', () => {
        process.env.PRODUCTBOARD_AUTH_TYPE = 'bearer';
        // No token set

        const configManager = new ConfigManager();
        const result = configManager.validate();

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Bearer token authentication requires PRODUCTBOARD_API_TOKEN');
      });

      it('should pass validation with complete OAuth2 configuration', () => {
        process.env.PRODUCTBOARD_AUTH_TYPE = 'oauth2';
        process.env.PRODUCTBOARD_OAUTH_CLIENT_ID = 'client-id';
        process.env.PRODUCTBOARD_OAUTH_CLIENT_SECRET = 'client-secret';

        const configManager = new ConfigManager();
        const result = configManager.validate();

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should fail validation when OAuth2 client ID is missing', () => {
        process.env.PRODUCTBOARD_AUTH_TYPE = 'oauth2';
        process.env.PRODUCTBOARD_OAUTH_CLIENT_SECRET = 'client-secret';
        // No client ID set

        const configManager = new ConfigManager();
        const result = configManager.validate();

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('OAuth2 authentication requires PRODUCTBOARD_OAUTH_CLIENT_ID');
      });

      it('should fail validation when OAuth2 client secret is missing', () => {
        process.env.PRODUCTBOARD_AUTH_TYPE = 'oauth2';
        process.env.PRODUCTBOARD_OAUTH_CLIENT_ID = 'client-id';
        // No client secret set

        const configManager = new ConfigManager();
        const result = configManager.validate();

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('OAuth2 authentication requires PRODUCTBOARD_OAUTH_CLIENT_SECRET');
      });

      it('should fail validation when both OAuth2 credentials are missing', () => {
        process.env.PRODUCTBOARD_AUTH_TYPE = 'oauth2';

        const configManager = new ConfigManager();
        const result = configManager.validate();

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('OAuth2 authentication requires PRODUCTBOARD_OAUTH_CLIENT_ID');
        expect(result.errors).toContain('OAuth2 authentication requires PRODUCTBOARD_OAUTH_CLIENT_SECRET');
      });
    });

    describe('server validation', () => {
      it('should pass validation with valid port numbers', () => {
        process.env.MCP_SERVER_PORT = '3000';
        process.env.PRODUCTBOARD_API_TOKEN = 'token';

        const configManager = new ConfigManager();
        const result = configManager.validate();

        expect(result.valid).toBe(true);
      });

      it('should fail validation with port number below 1', () => {
        process.env.MCP_SERVER_PORT = '0';
        process.env.PRODUCTBOARD_API_TOKEN = 'token';

        const configManager = new ConfigManager();
        const result = configManager.validate();

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Server port must be between 1 and 65535');
      });

      it('should fail validation with port number above 65535', () => {
        process.env.MCP_SERVER_PORT = '65536';
        process.env.PRODUCTBOARD_API_TOKEN = 'token';

        const configManager = new ConfigManager();
        const result = configManager.validate();

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Server port must be between 1 and 65535');
      });

      it('should pass validation with edge case port numbers', () => {
        // Test port 1
        process.env.MCP_SERVER_PORT = '1';
        process.env.PRODUCTBOARD_API_TOKEN = 'token';

        let configManager = new ConfigManager();
        let result = configManager.validate();
        expect(result.valid).toBe(true);

        // Test port 65535
        process.env.MCP_SERVER_PORT = '65535';
        configManager = new ConfigManager();
        result = configManager.validate();
        expect(result.valid).toBe(true);
      });
    });

    describe('API validation', () => {
      it('should pass validation with non-negative retry attempts', () => {
        process.env.API_RETRY_ATTEMPTS = '0';
        process.env.PRODUCTBOARD_API_TOKEN = 'token';

        const configManager = new ConfigManager();
        const result = configManager.validate();

        expect(result.valid).toBe(true);
      });

      it('should fail validation with negative retry attempts', () => {
        process.env.API_RETRY_ATTEMPTS = '-1';
        process.env.PRODUCTBOARD_API_TOKEN = 'token';

        const configManager = new ConfigManager();
        const result = configManager.validate();

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('API retry attempts must be non-negative');
      });
    });

    describe('rate limiting validation', () => {
      it('should pass validation with positive rate limit', () => {
        process.env.RATE_LIMIT_GLOBAL = '1';
        process.env.PRODUCTBOARD_API_TOKEN = 'token';

        const configManager = new ConfigManager();
        const result = configManager.validate();

        expect(result.valid).toBe(true);
      });

      it('should fail validation with zero rate limit', () => {
        process.env.RATE_LIMIT_GLOBAL = '0';
        process.env.PRODUCTBOARD_API_TOKEN = 'token';

        const configManager = new ConfigManager();
        const result = configManager.validate();

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Global rate limit must be at least 1');
      });

      it('should fail validation with negative rate limit', () => {
        process.env.RATE_LIMIT_GLOBAL = '-5';
        process.env.PRODUCTBOARD_API_TOKEN = 'token';

        const configManager = new ConfigManager();
        const result = configManager.validate();

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Global rate limit must be at least 1');
      });
    });

    describe('multiple validation errors', () => {
      it('should collect all validation errors', () => {
        process.env.PRODUCTBOARD_AUTH_TYPE = 'oauth2';
        // Missing OAuth credentials
        process.env.MCP_SERVER_PORT = '70000'; // Invalid port
        process.env.API_RETRY_ATTEMPTS = '-1'; // Invalid retry attempts
        process.env.RATE_LIMIT_GLOBAL = '0'; // Invalid rate limit

        const configManager = new ConfigManager();
        const result = configManager.validate();

        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(5);
        expect(result.errors).toContain('OAuth2 authentication requires PRODUCTBOARD_OAUTH_CLIENT_ID');
        expect(result.errors).toContain('OAuth2 authentication requires PRODUCTBOARD_OAUTH_CLIENT_SECRET');
        expect(result.errors).toContain('Server port must be between 1 and 65535');
        expect(result.errors).toContain('API retry attempts must be non-negative');
        expect(result.errors).toContain('Global rate limit must be at least 1');
      });
    });
  });

  describe('get method', () => {
    it('should return a copy of the configuration', () => {
      const configManager = new ConfigManager();
      const config1 = configManager.get();
      const config2 = configManager.get();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Should be different objects
    });

    it('should return immutable configuration object', () => {
      const configManager = new ConfigManager();
      const config = configManager.get();

      // Attempting to modify the returned config should not affect the internal config
      (config as any).server.port = 9999;

      const newConfig = configManager.get();
      expect(newConfig.server.port).not.toBe(9999); // Should still be original value
    });
  });

  describe('update method', () => {
    it('should update configuration with partial updates', () => {
      const configManager = new ConfigManager();
      
      const updates: Partial<Config> = {
        server: {
          port: 9000,
          host: 'updated.example.com',
          timeout: 45000,
        },
        logLevel: 'debug' as LogLevel,
      };

      configManager.update(updates);
      const config = configManager.get();

      expect(config.server.port).toBe(9000);
      expect(config.server.host).toBe('updated.example.com');
      expect(config.server.timeout).toBe(45000);
      expect(config.logLevel).toBe('debug');
      
      // Other values should remain unchanged
      expect(config.auth.type).toBe(AuthenticationType.BEARER_TOKEN);
      expect(config.api.baseUrl).toBe('https://api.productboard.com/v1');
    });

    it('should merge nested configuration updates correctly', () => {
      const configManager = new ConfigManager();
      
      const updates: Partial<Config> = {
        auth: {
          type: AuthenticationType.OAUTH2,
          clientId: 'new-client-id',
        } as any,
        api: {
          timeout: 15000,
        } as any,
      };

      configManager.update(updates);
      const config = configManager.get();

      expect(config.auth.type).toBe(AuthenticationType.OAUTH2);
      expect(config.auth.clientId).toBe('new-client-id');
      expect(config.api.timeout).toBe(15000);
      
      // Other nested values should remain
      expect(config.api.baseUrl).toBe('https://api.productboard.com/v1');
      expect(config.api.retryAttempts).toBe(3);
    });

    it('should handle empty updates gracefully', () => {
      const configManager = new ConfigManager();
      const originalConfig = configManager.get();
      
      configManager.update({});
      const updatedConfig = configManager.get();

      expect(updatedConfig).toEqual(originalConfig);
    });
  });

  describe('edge cases and error scenarios', () => {
    it('should handle missing process.cwd gracefully', () => {
      const originalCwd = process.cwd;
      process.cwd = jest.fn().mockImplementation(() => {
        throw new Error('cwd failed');
      }) as any;

      expect(() => new ConfigManager()).not.toThrow();

      process.cwd = originalCwd;
    });

    it('should handle JSON parse errors in default config file', () => {
      mockReadFileSync.mockReturnValue('{ "invalid": json }');

      const configManager = new ConfigManager();
      const config = configManager.get();

      // Should fall back to defaults
      expect(config.server.port).toBe(3000);
      expect(config.logLevel).toBe('info');
    });

    it('should handle extremely large environment variable values', () => {
      process.env.MCP_SERVER_PORT = '999999999999999999999';
      process.env.CACHE_MAX_SIZE = '999999999999999999999';

      const configManager = new ConfigManager();
      const config = configManager.get();

      expect(typeof config.server.port).toBe('number');
      expect(typeof config.cache.maxSize).toBe('number');
    });

    it('should handle special characters in environment variables', () => {
      process.env.PRODUCTBOARD_API_TOKEN = 'token-with-special-chars!@#$%^&*()';
      process.env.MCP_SERVER_HOST = 'host.with.dots.and-dashes';

      const configManager = new ConfigManager();
      const config = configManager.get();

      expect(config.auth.token).toBe('token-with-special-chars!@#$%^&*()');
      expect(config.server.host).toBe('host.with.dots.and-dashes');
    });

    it('should handle numeric string parsing edge cases', () => {
      process.env.MCP_SERVER_PORT = '3000.5'; // Float
      process.env.API_RETRY_ATTEMPTS = '3e2'; // Scientific notation
      process.env.CACHE_TTL = '0xFF'; // Hex

      const configManager = new ConfigManager();
      const config = configManager.get();

      expect(config.server.port).toBe(3000); // parseInt truncates
      expect(config.api.retryAttempts).toBe(3); // Scientific notation parsed as 3
      expect(config.cache.ttl).toBe(255); // Hex parsed
    });

    it('should handle boolean environment variable edge cases', () => {
      process.env.CACHE_ENABLED = 'TRUE'; // Uppercase
      process.env.LOG_PRETTY = '1'; // Numeric true

      const configManager = new ConfigManager();
      const config = configManager.get();

      expect(config.cache.enabled).toBe(false); // Only 'true' should be true
      expect(config.logPretty).toBe(false); // Only 'true' should be true
    });

    it('should handle unicode and non-ASCII characters', () => {
      process.env.PRODUCTBOARD_API_TOKEN = 'tökén-with-ünicøde-🔑';
      process.env.MCP_SERVER_HOST = 'hôst.éxample.com';

      const configManager = new ConfigManager();
      const config = configManager.get();

      expect(config.auth.token).toBe('tökén-with-ünicøde-🔑');
      expect(config.server.host).toBe('hôst.éxample.com');
    });
  });

  describe('comprehensive integration scenarios', () => {
    it('should handle complex real-world configuration scenario', () => {
      // Setup complex default configuration
      const defaultConfig = {
        server: {
          port: 8080,
          host: '0.0.0.0',
          timeout: 60000,
        },
        auth: {
          type: 'oauth2',
        },
        api: {
          baseUrl: 'https://staging.api.com/v1',
          timeout: 20000,
          retryAttempts: 5,
          retryDelay: 2000,
        },
        rateLimit: {
          global: 500,
          windowMs: 120000,
          perTool: {
            'create-feature': 10,
            'bulk-update': 5,
          },
        },
        cache: {
          enabled: true,
          ttl: 600,
          maxSize: 1000,
        },
        sampling: {
          temperature: 0.7,
          max_tokens: 1000,
        },
        resources: {
          enabled: true,
          refreshInterval: 600000,
        },
        prompts: {
          enabled: true,
          templatesPath: './custom-prompts',
        },
        logLevel: 'debug',
        logPretty: false,
        nodeEnv: 'staging',
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(defaultConfig));

      // Setup environment overrides
      process.env.MCP_SERVER_PORT = '3000';
      process.env.PRODUCTBOARD_AUTH_TYPE = 'bearer';
      process.env.PRODUCTBOARD_API_TOKEN = 'production-token';
      process.env.PRODUCTBOARD_API_BASE_URL = 'https://api.productboard.com/v1';
      process.env.CACHE_ENABLED = 'false';
      process.env.LOG_LEVEL = 'warn';
      process.env.LOG_PRETTY = 'true';
      process.env.NODE_ENV = 'production';

      const configManager = new ConfigManager();
      const config = configManager.get();

      // Verify environment overrides
      expect(config.server.port).toBe(3000);
      expect(config.auth.type).toBe(AuthenticationType.BEARER_TOKEN);
      expect(config.auth.token).toBe('production-token');
      expect(config.api.baseUrl).toBe('https://api.productboard.com/v1');
      expect(config.cache.enabled).toBe(false);
      expect(config.logLevel).toBe('warn');
      expect(config.logPretty).toBe(true);
      expect(config.nodeEnv).toBe('production');

      // Verify file values preserved where no env override  
      expect(config.server.host).toBe('localhost'); // Default value used
      expect(config.server.timeout).toBe(60000);
      expect(config.api.timeout).toBe(20000);
      expect(config.api.retryAttempts).toBe(5);
      expect(config.rateLimit.global).toBe(500);
      expect(config.rateLimit.perTool).toEqual({
        'create-feature': 10,
        'bulk-update': 5,
      });
      expect(config.sampling).toEqual({
        temperature: 0.7,
        max_tokens: 1000,
      });

      // Validate the configuration
      const validation = configManager.validate();
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should handle configuration validation in complex failure scenario', () => {
      // Setup configuration that will have multiple validation failures
      process.env.PRODUCTBOARD_AUTH_TYPE = 'oauth2';
      // OAuth credentials missing
      process.env.MCP_SERVER_PORT = '-1';
      process.env.API_RETRY_ATTEMPTS = '-5';
      process.env.RATE_LIMIT_GLOBAL = '0';

      const configManager = new ConfigManager();
      const validation = configManager.validate();

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(3);
      expect(validation.errors).toContain('OAuth2 authentication requires PRODUCTBOARD_OAUTH_CLIENT_ID');
      expect(validation.errors).toContain('OAuth2 authentication requires PRODUCTBOARD_OAUTH_CLIENT_SECRET');
      expect(validation.errors).toContain('Server port must be between 1 and 65535');
      expect(validation.errors).toContain('API retry attempts must be non-negative');
      expect(validation.errors).toContain('Global rate limit must be at least 1');
    });
  });
});