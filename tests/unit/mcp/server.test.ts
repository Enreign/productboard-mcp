import { ProductboardMCPServer, ServerDependencies } from '../../../src/core/server.js';
import { Config } from '../../../src/utils/config.js';

jest.mock('@modelcontextprotocol/sdk/server/index.js');
jest.mock('@modelcontextprotocol/sdk/server/stdio.js');

// Mock the MCP SDK types module
jest.mock('@modelcontextprotocol/sdk/types.js', () => ({
  ListToolsRequestSchema: 'ListToolsRequestSchema',
  CallToolRequestSchema: 'CallToolRequestSchema',
}));

describe('ProductboardMCPServer', () => {
  let server: ProductboardMCPServer;
  let mockDependencies: jest.Mocked<ServerDependencies>;
  let mockMCPServer: any;
  let mockTransport: any;
  let originalEnv: string | undefined;

  beforeAll(() => {
    // Save original NODE_ENV
    originalEnv = process.env.NODE_ENV;
  });

  afterAll(() => {
    // Restore original NODE_ENV
    if (originalEnv !== undefined) {
      process.env.NODE_ENV = originalEnv;
    } else {
      delete process.env.NODE_ENV;
    }
  });

  beforeEach(() => {
    // Set NODE_ENV to test to skip authentication and API checks
    process.env.NODE_ENV = 'test';
    // Mock the MCP SDK
    mockMCPServer = {
      connect: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      setRequestHandler: jest.fn(),
    };

    mockTransport = {
      start: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    };

    const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
    const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
    
    (Server as jest.Mock).mockImplementation(() => mockMCPServer);
    (StdioServerTransport as jest.Mock).mockImplementation(() => mockTransport);

    // Create mock dependencies
    mockDependencies = {
      config: {
        logLevel: 'info',
        logPretty: true,
        auth: {
          type: 'bearer',
          token: 'test-token',
        },
        api: {
          baseUrl: 'https://api.productboard.com',
          timeout: 5000,
        },
        rateLimit: {
          global: 60,
          windowMs: 60000,
          perTool: {},
        },
        cache: {
          ttl: 300000,
          maxSize: 1000,
        },
      } as Config,
      logger: {
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        fatal: jest.fn(),
      } as any,
      authManager: {
        validateCredentials: jest.fn().mockResolvedValue(true),
        getAuthHeaders: jest.fn().mockReturnValue({ Authorization: 'Bearer test-token' }),
        isTokenExpired: jest.fn().mockReturnValue(false),
      } as jest.Mocked<any>,
      apiClient: {
        testConnection: jest.fn().mockResolvedValue(true),
      } as jest.Mocked<any>,
      toolRegistry: {
        registerTool: jest.fn(),
        size: jest.fn().mockReturnValue(5),
        listTools: jest.fn().mockReturnValue([]),
        getTool: jest.fn(),
        hasTool: jest.fn(),
        getToolSchema: jest.fn(),
      } as any,
      rateLimiter: {
        waitForSlot: jest.fn().mockResolvedValue(undefined),
      } as any,
      cache: {
        get: jest.fn().mockReturnValue(null),
        set: jest.fn(),
        getCacheKey: jest.fn().mockReturnValue('cache-key'),
        shouldCache: jest.fn().mockReturnValue(true),
      } as jest.Mocked<any>,
      protocolHandler: {
        invokeTool: jest.fn().mockResolvedValue({ success: true, data: {} }),
      } as jest.Mocked<any>,
      resourceRegistry: {
        registerResource: jest.fn(),
        size: jest.fn().mockReturnValue(2),
        listResources: jest.fn().mockReturnValue([]),
        getResource: jest.fn(),
      } as any,
      promptRegistry: {
        registerPrompt: jest.fn(),
        size: jest.fn().mockReturnValue(2),
        listPrompts: jest.fn().mockReturnValue([]),
        getPrompt: jest.fn(),
      } as any,
      permissionDiscovery: {
        discoverUserPermissions: jest.fn().mockResolvedValue({
          accessLevel: 'write',
          isReadOnly: false,
          canWrite: true,
          canDelete: false,
          isAdmin: false,
          permissions: new Set(['features:read', 'features:write']),
          capabilities: {
            features: { read: true, write: true, delete: false },
            users: { read: true, write: false, admin: false },
          }
        }),
      } as any,
    };

    server = new ProductboardMCPServer(mockDependencies);
  });

  describe('Constructor and Static Factory', () => {
    it('should create server instance with dependencies', () => {
      expect(server).toBeInstanceOf(ProductboardMCPServer);
    });

    it('should create server from config using static factory', async () => {
      const config = {
        logLevel: 'info',
        logPretty: true,
        auth: {
          type: 'bearer',
          token: 'test-token',
        },
        api: {
          baseUrl: 'https://api.productboard.com',
          timeout: 5000,
        },
        rateLimit: {
          global: 60,
          windowMs: 60000,
          perTool: {},
        },
        cache: {
          ttl: 300000,
          maxSize: 1000,
        },
      } as Config;

      // Mock all the required constructors
      jest.doMock('../../../src/utils/logger.js', () => ({
        Logger: jest.fn().mockImplementation(() => mockDependencies.logger),
      }));
      
      jest.doMock('../../../src/auth/manager.js', () => ({
        AuthenticationManager: jest.fn().mockImplementation(() => mockDependencies.authManager),
      }));

      jest.doMock('../../../src/middleware/rateLimiter.js', () => ({
        RateLimiter: jest.fn().mockImplementation(() => mockDependencies.rateLimiter),
      }));

      jest.doMock('../../../src/api/client.js', () => ({
        ProductboardAPIClient: jest.fn().mockImplementation(() => mockDependencies.apiClient),
      }));

      const serverInstance = await ProductboardMCPServer.create(config);
      expect(serverInstance).toBeInstanceOf(ProductboardMCPServer);
    });
  });

  describe('Server Lifecycle', () => {
    it('should initialize server successfully', async () => {
      await server.initialize();

      expect(mockDependencies.logger.info).toHaveBeenCalledWith('Initializing Productboard MCP Server...');
      // In test mode, auth and API checks are skipped
      expect(mockDependencies.logger.info).toHaveBeenCalledWith('Skipping authentication validation in test mode');
      expect(mockDependencies.logger.info).toHaveBeenCalledWith('Skipping API connection test in test mode');
      expect(mockDependencies.logger.info).toHaveBeenCalledWith('Skipping permission discovery in test mode');
      expect(mockDependencies.logger.info).toHaveBeenCalledWith('Productboard MCP Server initialized successfully');
    });

    it('should fail initialization if authentication validation fails (non-test mode)', async () => {
      // Temporarily set to non-test mode
      delete process.env.NODE_ENV;
      
      (mockDependencies.authManager.validateCredentials as jest.Mock).mockResolvedValue(false);

      await expect(server.initialize()).rejects.toThrow('Authentication validation failed');
      expect(mockDependencies.logger.fatal).toHaveBeenCalled();
      
      // Restore test mode
      process.env.NODE_ENV = 'test';
    });

    it('should fail initialization if API connection test fails (non-test mode)', async () => {
      // Temporarily set to non-test mode
      delete process.env.NODE_ENV;
      
      (mockDependencies.apiClient.testConnection as jest.Mock).mockResolvedValue(false);

      await expect(server.initialize()).rejects.toThrow('API connection test failed');
      expect(mockDependencies.logger.fatal).toHaveBeenCalled();
      
      // Restore test mode
      process.env.NODE_ENV = 'test';
    });

    it('should start server successfully after initialization', async () => {
      await server.initialize();
      await server.start();

      expect(mockMCPServer.connect).toHaveBeenCalledWith(mockTransport);
      expect(mockDependencies.logger.info).toHaveBeenCalledWith('Productboard MCP Server started successfully');
    });

    it('should fail to start if not initialized', async () => {
      await expect(server.start()).rejects.toThrow('Server not initialized');
    });

    it('should stop server successfully', async () => {
      await server.initialize();
      await server.start();
      await server.stop();

      expect(mockMCPServer.close).toHaveBeenCalled();
      expect(mockDependencies.logger.info).toHaveBeenCalledWith('Productboard MCP Server stopped successfully');
    });
  });

  describe('MCP Request Handlers', () => {
    beforeEach(async () => {
      await server.initialize();
    });

    it('should set up tools/list handler', () => {
      expect(mockMCPServer.setRequestHandler).toHaveBeenCalledWith('ListToolsRequestSchema', expect.any(Function));
    });

    it('should set up tools/call handler', () => {
      expect(mockMCPServer.setRequestHandler).toHaveBeenCalledWith('CallToolRequestSchema', expect.any(Function));
    });

    it('should handle tools/list request', async () => {
      const toolsListCall = mockMCPServer.setRequestHandler.mock.calls.find(
        (call: any) => call[0] === 'ListToolsRequestSchema'
      );
      expect(toolsListCall).toBeDefined();

      const handler = toolsListCall[1];
      const result = await handler();

      expect(result).toEqual({
        tools: [],
      });
      expect(mockDependencies.toolRegistry.listTools).toHaveBeenCalled();
    });

    it('should handle tools/call request successfully', async () => {
      const toolsCallHandler = mockMCPServer.setRequestHandler.mock.calls.find(
        (call: any) => call[0] === 'CallToolRequestSchema'
      )[1];

      const request = {
        params: {
          name: 'pb_feature_create',
          arguments: { name: 'Test Feature', description: 'Test' },
        },
      };

      const result = await toolsCallHandler(request);

      expect(mockDependencies.protocolHandler.invokeTool).toHaveBeenCalledWith(
        'pb_feature_create',
        { name: 'Test Feature', description: 'Test' }
      );
      expect(result).toEqual({ success: true, data: {} });
    });

    it('should handle tools/call request with caching', async () => {
      (mockDependencies.cache.get as jest.Mock).mockReturnValue({ cached: true, data: 'cached-result' });

      const toolsCallHandler = mockMCPServer.setRequestHandler.mock.calls.find(
        (call: any) => call[0] === 'CallToolRequestSchema'
      )[1];

      const request = {
        params: {
          name: 'pb_feature_get',
          arguments: { id: 'feature-1' },
        },
      };

      const result = await toolsCallHandler(request);

      expect(result).toEqual({ cached: true, data: 'cached-result' });
      expect(mockDependencies.cache.get).toHaveBeenCalled();
      expect(mockDependencies.protocolHandler.invokeTool).not.toHaveBeenCalled();
      expect(mockDependencies.logger.debug).toHaveBeenCalledWith('Cache hit for tool: pb_feature_get');
    });

    it('should cache results for cacheable operations', async () => {
      (mockDependencies.cache.get as jest.Mock).mockReturnValue(null);
      (mockDependencies.cache.shouldCache as jest.Mock).mockReturnValue(true);

      const toolsCallHandler = mockMCPServer.setRequestHandler.mock.calls.find(
        (call: any) => call[0] === 'CallToolRequestSchema'
      )[1];

      const request = {
        params: {
          name: 'pb_feature_list',
          arguments: {},
        },
      };

      await toolsCallHandler(request);

      expect(mockDependencies.cache.set).toHaveBeenCalled();
      expect(mockDependencies.logger.debug).toHaveBeenCalledWith('Cached result for tool: pb_feature_list');
    });

    it('should handle tool execution errors', async () => {
      (mockDependencies.protocolHandler.invokeTool as jest.Mock).mockRejectedValue(new Error('Tool execution failed'));

      const toolsCallHandler = mockMCPServer.setRequestHandler.mock.calls.find(
        (call: any) => call[0] === 'CallToolRequestSchema'
      )[1];

      const request = {
        params: {
          name: 'pb_feature_create',
          arguments: { invalid: 'params' },
        },
      };

      await expect(toolsCallHandler(request)).rejects.toThrow('Tool execution failed');
      expect(mockDependencies.logger.error).toHaveBeenCalledWith('Tool execution failed', expect.any(Error));
    });
  });

  describe('Tool Registration', () => {
    it('should register all Productboard tools', async () => {
      // Mock tool constructors with proper structure
      const createMockTool = (name: string) => {
        const MockTool = function(this: any) {
          this.name = name;
          this.execute = jest.fn();
          this.isAvailableForUser = jest.fn().mockReturnValue(true);
          this.getMissingPermissions = jest.fn().mockReturnValue([]);
        };
        MockTool.prototype.execute = jest.fn();
        Object.defineProperty(MockTool, 'name', { value: name });
        return MockTool;
      };

      // Mock the tools import
      jest.doMock('../../../src/tools/index.js', () => ({
        CreateFeatureTool: createMockTool('CreateFeatureTool'),
        ListFeaturesTool: createMockTool('ListFeaturesTool'),
        UpdateFeatureTool: createMockTool('UpdateFeatureTool'),
        DeleteFeatureTool: createMockTool('DeleteFeatureTool'),
        GetFeatureTool: createMockTool('GetFeatureTool'),
        ListProductsTool: createMockTool('ListProductsTool'),
        CreateProductTool: createMockTool('CreateProductTool'),
        ProductHierarchyTool: createMockTool('ProductHierarchyTool'),
        CreateNoteTool: createMockTool('CreateNoteTool'),
        ListNotesTool: createMockTool('ListNotesTool'),
        AttachNoteTool: createMockTool('AttachNoteTool'),
        ListUsersTool: createMockTool('ListUsersTool'),
        CurrentUserTool: createMockTool('CurrentUserTool'),
        ListCompaniesTool: createMockTool('ListCompaniesTool'),
        GlobalSearchTool: createMockTool('GlobalSearchTool'),
        BulkUpdateFeaturesTool: createMockTool('BulkUpdateFeaturesTool'),
      }));

      await server.initialize();

      // Verify that tools were registered
      // In test mode with no user permissions set, all tools should attempt to register
      expect(mockDependencies.toolRegistry.registerTool).toHaveBeenCalled();
      expect(mockDependencies.logger.info).toHaveBeenCalledWith('Registering Productboard tools...');
    });
  });

  describe('Health and Metrics', () => {
    beforeEach(async () => {
      await server.initialize();
    });

    it('should return health status', () => {
      const health = server.getHealth();

      expect(health).toMatchObject({
        status: 'healthy',
        version: '1.0.0',
        uptime: expect.any(Number),
        checks: {
          api: true,
          auth: true,
          rateLimit: true,
        },
      });
    });

    it('should return server metrics', () => {
      const metrics = server.getMetrics();

      expect(metrics).toMatchObject({
        uptime: expect.any(Number),
        requestsTotal: 0,
        requestsSuccess: 0,
        requestsFailed: 0,
        averageResponseTime: 0,
        activeConnections: 0,
      });
    });

    it('should update metrics on successful request', async () => {
      const toolsCallHandler = mockMCPServer.setRequestHandler.mock.calls.find(
        (call: any) => call[0] === 'CallToolRequestSchema'
      )[1];

      const request = {
        params: {
          name: 'pb_feature_list',
          arguments: {},
        },
      };

      await toolsCallHandler(request);

      const metrics = server.getMetrics();
      expect(metrics.requestsTotal).toBe(1);
      expect(metrics.requestsSuccess).toBe(1);
      expect(metrics.requestsFailed).toBe(0);
    });

    it('should update metrics on failed request', async () => {
      (mockDependencies.protocolHandler.invokeTool as jest.Mock).mockRejectedValue(new Error('Tool failed'));

      const toolsCallHandler = mockMCPServer.setRequestHandler.mock.calls.find(
        (call: any) => call[0] === 'CallToolRequestSchema'
      )[1];

      const request = {
        params: {
          name: 'pb_feature_create',
          arguments: {},
        },
      };

      try {
        await toolsCallHandler(request);
      } catch (error) {
        // Expected to fail
      }

      const metrics = server.getMetrics();
      expect(metrics.requestsTotal).toBe(1);
      expect(metrics.requestsSuccess).toBe(0);
      expect(metrics.requestsFailed).toBe(1);
    });
  });

  describe('Server Configuration', () => {
    it('should initialize MCP server with correct configuration', async () => {
      await server.initialize();

      expect(mockMCPServer).toBeTruthy();
      expect(mockTransport).toBeTruthy();
      
      // Verify Server constructor was called with correct config
      const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
      expect(Server).toHaveBeenCalledWith(
        {
          name: 'productboard-mcp',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
            // resources and prompts temporarily disabled
          },
        }
      );
    });

    it('should handle server initialization errors gracefully', async () => {
      // Mock a tool registration error since auth checks are skipped in test mode
      const mockError = new Error('Tool registration failed');
      jest.spyOn(server as any, 'registerTools').mockRejectedValue(mockError);

      await expect(server.initialize()).rejects.toThrow('Tool registration failed');
      expect(mockDependencies.logger.fatal).toHaveBeenCalledWith('Failed to initialize server', expect.any(Error));
    });

    it('should handle server start errors gracefully', async () => {
      await server.initialize();
      mockMCPServer.connect.mockRejectedValue(new Error('Connection failed'));

      await expect(server.start()).rejects.toThrow('Connection failed');
      expect(mockDependencies.logger.fatal).toHaveBeenCalledWith('Failed to start server', expect.any(Error));
    });

    it('should handle server stop errors gracefully', async () => {
      await server.initialize();
      await server.start();
      mockMCPServer.close.mockRejectedValue(new Error('Close failed'));

      await expect(server.stop()).rejects.toThrow('Close failed');
      expect(mockDependencies.logger.error).toHaveBeenCalledWith('Error while stopping server', expect.any(Error));
    });
  });

  describe('Response Time Tracking', () => {
    beforeEach(async () => {
      await server.initialize();
    });

    it('should track and calculate average response times', async () => {
      const toolsCallHandler = mockMCPServer.setRequestHandler.mock.calls.find(
        (call: any) => call[0] === 'CallToolRequestSchema'
      )[1];

      // Simulate multiple requests with delays
      (mockDependencies.protocolHandler.invokeTool as jest.Mock)
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: true });

      const request = {
        params: {
          name: 'pb_feature_list',
          arguments: {},
        },
      };

      // Execute multiple requests
      await toolsCallHandler(request);
      await toolsCallHandler(request);
      await toolsCallHandler(request);

      const metrics = server.getMetrics();
      expect(metrics.requestsTotal).toBe(3);
      expect(metrics.requestsSuccess).toBe(3);
      expect(metrics.averageResponseTime).toBeGreaterThanOrEqual(0);
    });
  });
});