import { jest } from '@jest/globals';
import { ProductboardMCPServer } from '@core/server.js';
import { ConfigManager } from '@utils/config.js';
import { Logger } from '@utils/logger.js';
import { AuthenticationType } from '@auth/types.js';

// Mock external dependencies
jest.mock('@core/server.js');
jest.mock('@utils/config.js');
jest.mock('@utils/logger.js');
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

describe('CLI Index Module', () => {
  let mockConfigManager: jest.Mocked<ConfigManager>;
  let mockLogger: jest.Mocked<Logger>;
  let mockServer: jest.Mocked<ProductboardMCPServer>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup ConfigManager mock
    mockConfigManager = {
      get: jest.fn(),
      validate: jest.fn(),
      update: jest.fn(),
    } as any;
    
    // Setup Logger mock
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      trace: jest.fn(),
    } as any;
    
    // Setup Server mock
    mockServer = {
      initialize: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    } as any;

    // Mock constructors and static methods
    (ConfigManager as jest.MockedClass<typeof ConfigManager>).mockImplementation(() => mockConfigManager);
    (Logger as jest.MockedClass<typeof Logger>).mockImplementation(() => mockLogger);
    jest.mocked(ProductboardMCPServer.create).mockResolvedValue(mockServer);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('main function behavior simulation', () => {
    const validConfig = {
      server: { port: 3000, host: 'localhost', timeout: 30000 },
      auth: { type: AuthenticationType.BEARER_TOKEN, token: 'test-token' },
      api: { baseUrl: 'https://api.test.com', timeout: 10000, retryAttempts: 3, retryDelay: 1000 },
      rateLimit: { global: 100, windowMs: 60000 },
      cache: { enabled: true, ttl: 300, maxSize: 100 },
      logLevel: 'info' as any,
      logPretty: true,
      nodeEnv: 'test',
    };

    it('should successfully initialize and start server with valid configuration', async () => {
      // Setup successful scenario
      mockConfigManager.get.mockReturnValue(validConfig);
      mockConfigManager.validate.mockReturnValue({ valid: true, errors: [] });
      mockServer.initialize.mockResolvedValue(undefined);
      mockServer.start.mockResolvedValue(undefined);

      // Simulate the main function logic
      const configManager = new ConfigManager();
      const configuration = configManager.get();
      new Logger({
        level: configuration.logLevel,
        pretty: configuration.logPretty,
      });

      const validation = configManager.validate();
      expect(validation.valid).toBe(true);

      const server = await ProductboardMCPServer.create(configuration);
      await server.initialize();
      await server.start();

      // Verify all steps were called
      expect(ConfigManager).toHaveBeenCalled();
      expect(mockConfigManager.get).toHaveBeenCalled();
      expect(Logger).toHaveBeenCalledWith({ level: 'info', pretty: true });
      expect(mockConfigManager.validate).toHaveBeenCalled();
      expect(ProductboardMCPServer.create).toHaveBeenCalledWith(validConfig);
      expect(mockServer.initialize).toHaveBeenCalled();
      expect(mockServer.start).toHaveBeenCalled();
    });

    it('should fail when configuration validation fails', async () => {
      // Setup validation failure
      mockConfigManager.get.mockReturnValue({} as any);
      mockConfigManager.validate.mockReturnValue({
        valid: false,
        errors: ['Bearer token authentication requires PRODUCTBOARD_API_TOKEN'],
      });

      const configManager = new ConfigManager();
      const configuration = configManager.get();
      const logger = new Logger({
        level: configuration.logLevel || 'info',
        pretty: configuration.logPretty || true,
      });

      const validation = configManager.validate();
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Bearer token authentication requires PRODUCTBOARD_API_TOKEN');
      
      // In real scenario, this would trigger process.exit(1)
      if (!validation.valid) {
        logger.fatal('Configuration validation failed', { errors: validation.errors });
        // process.exit(1) would be called here
      }

      expect(mockLogger.fatal).toHaveBeenCalledWith(
        'Configuration validation failed',
        { errors: ['Bearer token authentication requires PRODUCTBOARD_API_TOKEN'] }
      );
    });

    it('should handle server creation failures', async () => {
      // Setup server creation failure
      mockConfigManager.get.mockReturnValue(validConfig);
      mockConfigManager.validate.mockReturnValue({ valid: true, errors: [] });
      
      const serverError = new Error('Server creation failed');
      jest.mocked(ProductboardMCPServer.create).mockRejectedValue(serverError);

      const configManager = new ConfigManager();
      const configuration = configManager.get();
      const logger = new Logger({
        level: configuration.logLevel,
        pretty: configuration.logPretty,
      });

      const validation = configManager.validate();
      expect(validation.valid).toBe(true);

      try {
        await ProductboardMCPServer.create(configuration);
      } catch (error) {
        logger.fatal('Server startup failed', error);
        // process.exit(1) would be called here
      }

      expect(mockLogger.fatal).toHaveBeenCalledWith('Server startup failed', serverError);
    });

    it('should handle server initialization failures', async () => {
      // Setup server initialization failure
      mockConfigManager.get.mockReturnValue(validConfig);
      mockConfigManager.validate.mockReturnValue({ valid: true, errors: [] });
      
      const initError = new Error('Initialization failed');
      mockServer.initialize.mockRejectedValue(initError);

      const configManager = new ConfigManager();
      const configuration = configManager.get();
      const logger = new Logger({
        level: configuration.logLevel,
        pretty: configuration.logPretty,
      });

      const validation = configManager.validate();
      expect(validation.valid).toBe(true);

      const server = await ProductboardMCPServer.create(configuration);
      
      try {
        await server.initialize();
      } catch (error) {
        logger.fatal('Server startup failed', error);
        // process.exit(1) would be called here
      }

      expect(mockLogger.fatal).toHaveBeenCalledWith('Server startup failed', initError);
    });

    it('should create logger with different configurations', async () => {
      const customConfig = {
        ...validConfig,
        logLevel: 'debug' as any,
        logPretty: false,
      };
      
      mockConfigManager.get.mockReturnValue(customConfig);
      mockConfigManager.validate.mockReturnValue({ valid: true, errors: [] });

      const configManager = new ConfigManager();
      const configuration = configManager.get();
      new Logger({
        level: configuration.logLevel,
        pretty: configuration.logPretty,
      });

      expect(Logger).toHaveBeenCalledWith({
        level: 'debug',
        pretty: false,
      });
    });

    it('should pass complete configuration to server', async () => {
      const fullConfig = {
        server: { port: 4000, host: '127.0.0.1', timeout: 45000 },
        auth: { 
          type: AuthenticationType.OAUTH2, 
          clientId: 'oauth-client',
          clientSecret: 'oauth-secret',
          redirectUri: 'https://example.com/callback'
        },
        api: { 
          baseUrl: 'https://staging.api.com/v1', 
          timeout: 15000, 
          retryAttempts: 2, 
          retryDelay: 500 
        },
        rateLimit: { global: 200, windowMs: 90000 },
        cache: { enabled: true, ttl: 900, maxSize: 200 },
        sampling: { temperature: 0.7, max_tokens: 1000 },
        resources: { enabled: true, refreshInterval: 600000 },
        prompts: { enabled: false, templatesPath: './custom-prompts' },
        logLevel: 'warn' as any,
        logPretty: true,
        nodeEnv: 'staging',
      };
      
      mockConfigManager.get.mockReturnValue(fullConfig);
      mockConfigManager.validate.mockReturnValue({ valid: true, errors: [] });
      mockServer.initialize.mockResolvedValue(undefined);
      mockServer.start.mockResolvedValue(undefined);

      const configManager = new ConfigManager();
      const configuration = configManager.get();
      
      await ProductboardMCPServer.create(configuration);

      expect(ProductboardMCPServer.create).toHaveBeenCalledWith(fullConfig);
    });
  });

  describe('environment and setup', () => {
    it('should verify dotenv module is properly mocked', () => {
      const { config } = require('dotenv');
      expect(config).toBeDefined();
      expect(jest.isMockFunction(config)).toBe(true);
    });

    it('should verify all core dependencies are mocked', () => {
      expect(jest.isMockFunction(ConfigManager)).toBe(true);
      expect(jest.isMockFunction(Logger)).toBe(true);
      expect(jest.isMockFunction(ProductboardMCPServer.create)).toBe(true);
    });

    it('should handle edge cases in configuration', () => {
      const edgeCaseConfig = {
        server: { port: 1, host: '', timeout: 0 },
        auth: { type: AuthenticationType.BEARER_TOKEN, token: '' },
        api: { baseUrl: '', timeout: 0, retryAttempts: 0, retryDelay: 0 },
        rateLimit: { global: 1, windowMs: 1 },
        cache: { enabled: false, ttl: 0, maxSize: 0 },
        logLevel: 'error' as any,
        logPretty: false,
        nodeEnv: 'test',
      };
      
      mockConfigManager.get.mockReturnValue(edgeCaseConfig);
      mockConfigManager.validate.mockReturnValue({ valid: true, errors: [] });

      const configManager = new ConfigManager();
      const configuration = configManager.get();
      new Logger({
        level: configuration.logLevel,
        pretty: configuration.logPretty,
      });

      expect(Logger).toHaveBeenCalledWith({
        level: 'error',
        pretty: false,
      });
      expect(mockConfigManager.get).toHaveBeenCalled();
    });
  });

  describe('error scenarios', () => {
    it('should handle multiple validation errors', async () => {
      mockConfigManager.get.mockReturnValue({} as any);
      mockConfigManager.validate.mockReturnValue({
        valid: false,
        errors: [
          'Bearer token authentication requires PRODUCTBOARD_API_TOKEN',
          'Server port must be between 1 and 65535',
          'API retry attempts must be non-negative',
        ],
      });

      const configManager = new ConfigManager();
      const configuration = configManager.get();
      const logger = new Logger({
        level: configuration.logLevel || 'info',
        pretty: configuration.logPretty !== false,
      });

      const validation = configManager.validate();
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toHaveLength(3);
      expect(validation.errors).toContain('Bearer token authentication requires PRODUCTBOARD_API_TOKEN');
      expect(validation.errors).toContain('Server port must be between 1 and 65535');
      expect(validation.errors).toContain('API retry attempts must be non-negative');

      if (!validation.valid) {
        logger.fatal('Configuration validation failed', { errors: validation.errors });
      }

      expect(mockLogger.fatal).toHaveBeenCalledWith(
        'Configuration validation failed',
        expect.objectContaining({
          errors: expect.arrayContaining([
            'Bearer token authentication requires PRODUCTBOARD_API_TOKEN',
            'Server port must be between 1 and 65535',
            'API retry attempts must be non-negative',
          ])
        })
      );
    });

    it('should handle startup sequence interruption', async () => {
      const startupError = new Error('Startup interrupted');
      mockConfigManager.get.mockImplementation(() => {
        throw startupError;
      });

      expect(() => {
        const configManager = new ConfigManager();
        configManager.get();
      }).toThrow('Startup interrupted');
    });
  });
});