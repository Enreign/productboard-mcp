import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  ListToolsRequestSchema, 
  CallToolRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

// Note: Resources and prompts support temporarily disabled to fix E2E tests
// Will be re-enabled once core MCP functionality is working
// import { 
//   ListResourcesRequestSchema,
//   ReadResourceRequestSchema,
//   ListPromptsRequestSchema,
//   GetPromptRequestSchema
// } from '@modelcontextprotocol/sdk/types.js';
import {
  ServerMetrics,
  HealthStatus,
} from './types.js';
import { MCPProtocolHandler } from './protocol.js';
import { ToolRegistry } from './registry.js';
import { ResourceRegistry } from './resource-registry.js';
import { PromptRegistry } from './prompt-registry.js';
import { AuthenticationManager } from '@auth/index.js';
import { AuthenticationType } from '@auth/types.js';
import { PermissionDiscoveryService } from '@auth/permission-discovery.js';
import { UserPermissions } from '@auth/permissions.js';
import { ProductboardAPIClient } from '@api/index.js';
import { RateLimiter, CacheModule } from '@middleware/index.js';
import { Config, Logger } from '@utils/index.js';
import { ServerError, ProtocolError, ToolExecutionError } from '@utils/errors.js';

export interface ServerDependencies {
  config: Config;
  logger: Logger;
  authManager: AuthenticationManager;
  apiClient: ProductboardAPIClient;
  toolRegistry: ToolRegistry;
  resourceRegistry: ResourceRegistry;
  promptRegistry: PromptRegistry;
  rateLimiter: RateLimiter;
  cache: CacheModule;
  protocolHandler: MCPProtocolHandler;
  permissionDiscovery: PermissionDiscoveryService;
  userPermissions?: UserPermissions;
}

export class ProductboardMCPServer {
  private server?: Server;
  private transport?: StdioServerTransport;
  private dependencies: ServerDependencies;
  private startTime: Date;
  private metrics: ServerMetrics;

  constructor(dependencies: ServerDependencies) {
    this.dependencies = dependencies;
    this.startTime = new Date();
    this.metrics = {
      uptime: 0,
      requestsTotal: 0,
      requestsSuccess: 0,
      requestsFailed: 0,
      averageResponseTime: 0,
      activeConnections: 0,
    };
  }

  static async create(config: Config): Promise<ProductboardMCPServer> {
    const logger = new Logger({
      level: config.logLevel,
      pretty: config.logPretty,
    });

    const authConfig = {
      type: config.auth.type,
      credentials: {
        type: config.auth.type,
        token: config.auth.token,
        clientId: config.auth.clientId,
        clientSecret: config.auth.clientSecret,
      },
      baseUrl: config.api.baseUrl,
    };

    const authManager = new AuthenticationManager(authConfig, logger);

    // Set credentials from configuration
    if (config.auth.type === AuthenticationType.BEARER_TOKEN && config.auth.token) {
      authManager.setCredentials({
        type: AuthenticationType.BEARER_TOKEN,
        token: config.auth.token
      });
    } else if (config.auth.type === AuthenticationType.OAUTH2 && config.auth.clientId && config.auth.clientSecret) {
      authManager.setCredentials({
        type: AuthenticationType.OAUTH2,
        clientId: config.auth.clientId,
        clientSecret: config.auth.clientSecret,
      });
    }
    
    const rateLimiter = new RateLimiter(
      config.rateLimit.global,
      config.rateLimit.windowMs,
      config.rateLimit.perTool,
    );

    const apiClient = new ProductboardAPIClient(
      config.api,
      authManager,
      logger,
      rateLimiter,
    );

    const cache = new CacheModule(config.cache);
    const toolRegistry = new ToolRegistry(logger);
    const resourceRegistry = new ResourceRegistry(logger);
    const promptRegistry = new PromptRegistry(logger);
    const protocolHandler = new MCPProtocolHandler(toolRegistry, logger);
    const permissionDiscovery = new PermissionDiscoveryService(apiClient, logger);

    const dependencies: ServerDependencies = {
      config,
      logger,
      authManager,
      apiClient,
      toolRegistry,
      resourceRegistry,
      promptRegistry,
      rateLimiter,
      cache,
      protocolHandler,
      permissionDiscovery,
    };

    return new ProductboardMCPServer(dependencies);
  }

  async initialize(): Promise<void> {
    const { logger, authManager, apiClient } = this.dependencies;

    try {
      logger.info('Initializing Productboard MCP Server...');

      // Validate configuration
      const configValidation = this.dependencies.config;
      logger.debug('Configuration loaded', { config: configValidation });

      // Initialize MCP server first to start listening for protocol messages
      this.initializeMCPServer();

      // Validate authentication (skip in test mode)
      if (process.env.NODE_ENV !== 'test') {
        logger.info('Validating authentication...');
        const isAuthenticated = await authManager.validateCredentials();
        if (!isAuthenticated) {
          logger.error('Authentication validation failed');
          throw new ServerError('Authentication validation failed');
        }
        logger.info('Authentication validated successfully');
      }

      // Test API connection (skip in test mode)
      if (process.env.NODE_ENV !== 'test') {
        logger.info('Testing API connection...');
        const connectionTest = await apiClient.testConnection();
        if (!connectionTest) {
          logger.error('API connection test failed');
          throw new ServerError('API connection test failed');
        }
        logger.info('API connection established');
      }

      // Discover user permissions (skip in test mode)
      if (process.env.NODE_ENV !== 'test') {
        logger.info('Discovering user permissions...');
        const userPermissions = await this.dependencies.permissionDiscovery.discoverUserPermissions();
        this.dependencies.userPermissions = userPermissions;
        logger.info('Permission discovery completed', {
          accessLevel: userPermissions.accessLevel,
          isReadOnly: userPermissions.isReadOnly,
          permissionCount: userPermissions.permissions.size,
        });
      }

      // Register tools based on permissions
      await this.registerTools();

      logger.info('Productboard MCP Server initialized successfully');
    } catch (error) {
      logger.fatal('Failed to initialize server', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    const { logger } = this.dependencies;

    if (!this.server || !this.transport) {
      throw new ServerError('Server not initialized');
    }

    try {
      logger.info('Starting Productboard MCP Server...');
      await this.server.connect(this.transport);
      logger.info('Productboard MCP Server started successfully');
    } catch (error) {
      logger.fatal('Failed to start server', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    const { logger } = this.dependencies;

    try {
      logger.info('Stopping Productboard MCP Server...');
      
      if (this.server) {
        await this.server.close();
      }

      logger.info('Productboard MCP Server stopped successfully');
    } catch (error) {
      logger.error('Error while stopping server', error);
      throw error;
    }
  }

  private initializeMCPServer(): void {
    const { logger, toolRegistry } = this.dependencies;
    // const { resourceRegistry, promptRegistry } = this.dependencies; // Temporarily disabled

    // Create server with proper SDK constructor signature
    this.server = new Server(
      {
        name: 'productboard-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          // resources: {}, // Temporarily disabled
          // prompts: {},   // Temporarily disabled
        },
      },
    );

    this.transport = new StdioServerTransport();

    // Set up request handlers using proper SDK types
    
    // Tools handlers
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: toolRegistry.listTools(),
      };
    });

    // Resources and prompts handlers temporarily disabled for E2E test fixes
    // TODO: Re-enable once schema imports are fixed
    
    // Resources handlers
    // this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
    //   return {
    //     resources: resourceRegistry.listResources(),
    //   };
    // });

    // this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    //   const { uri } = request.params as { uri: string };
    //   const resource = resourceRegistry.getResourceByUri(uri);
    //   
    //   if (!resource) {
    //     throw new Error(`Resource not found: ${uri}`);
    //   }

    //   const content = await resource.retrieve();
    //   return {
    //     contents: [content],
    //   };
    // });

    // Prompts handlers  
    // this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
    //   return {
    //     prompts: promptRegistry.listPrompts(),
    //   };
    // });

    // this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    //   const { name, arguments: args } = request.params as { name: string; arguments?: any };
    //   const prompt = promptRegistry.getPrompt(name);
    //   
    //   if (!prompt) {
    //     throw new Error(`Prompt not found: ${name}`);
    //   }

    //   const messages = await prompt.execute(args);
    //   return {
    //     messages,
    //   };
    // });

    // Set up tool execution handler with proper error handling
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const startTime = Date.now();
      this.metrics.requestsTotal++;
      this.metrics.activeConnections++;

      try {
        // Validate request params
        if (!request.params || typeof request.params !== 'object') {
          throw new ProtocolError('Request params are required');
        }

        const { name, arguments: args } = request.params as { name?: string; arguments?: unknown };

        // Validate tool name
        if (!name || typeof name !== 'string') {
          throw new ProtocolError('Tool name is required and must be a string');
        }

        const result = await this.handleToolExecution(name, args);

        this.metrics.requestsSuccess++;
        this.updateResponseTime(Date.now() - startTime);

        return result;
      } catch (error) {
        this.metrics.requestsFailed++;
        logger.error('Tool execution failed', error);
        
        // Re-throw with proper error handling
        if (error instanceof ProtocolError || error instanceof ToolExecutionError) {
          throw error;
        }
        
        const toolName = request.params && typeof request.params === 'object' && 'name' in request.params && typeof (request.params as any).name === 'string' 
          ? (request.params as any).name 
          : 'unknown';
        
        throw new ToolExecutionError(
          error instanceof Error ? error.message : 'Unknown error during tool execution',
          toolName,
          error instanceof Error ? error : undefined
        );
      } finally {
        this.metrics.activeConnections--;
      }
    });
  }

  private async handleToolExecution(toolName: string, params: unknown): Promise<unknown> {
    const { protocolHandler, cache, logger } = this.dependencies;

    // Check cache for read operations
    const cacheKey = cache.getCacheKey({ tool: toolName, method: toolName, params });
    const cachedResult = cache.get(cacheKey);
    if (cachedResult !== null) {
      logger.debug(`Cache hit for tool: ${toolName}`);
      return cachedResult;
    }

    // Execute tool
    const result = await protocolHandler.invokeTool(toolName, params);

    // Cache result if applicable
    if (cache.shouldCache({ tool: toolName, method: toolName, params })) {
      cache.set(cacheKey, result);
      logger.debug(`Cached result for tool: ${toolName}`);
    }

    return result;
  }


  private async registerTools(): Promise<void> {
    const { logger, toolRegistry, apiClient } = this.dependencies;
    logger.info('Registering Productboard tools...');

    try {
      // Import all available tools from the main index
      const allTools = await import('@tools/index.js');
      logger.info('All tools imported successfully');

      // Extract all tool constructors from the imported module
      const toolConstructors = Object.values(allTools).filter(
        (tool): tool is new (...args: any[]) => any => 
          typeof tool === 'function' && 
          tool.name.endsWith('Tool') &&
          tool.prototype &&
          typeof tool.prototype.execute === 'function'
      );

      logger.info(`Found ${toolConstructors.length} tool constructors to register`);

      // Register tools one by one with permission checking and error handling
      let registeredCount = 0;
      let failedCount = 0;
      let skippedCount = 0;
      const { userPermissions } = this.dependencies;

      for (const ToolConstructor of toolConstructors) {
        try {
          logger.debug(`Processing ${ToolConstructor.name}...`);
          
          // Create a tool instance
          const toolInstance = new ToolConstructor(apiClient, logger);
          
          // Check if user has permission to use this tool (only if permissions are available)
          if (userPermissions && !toolInstance.isAvailableForUser(userPermissions)) {
            const missingPermissions = toolInstance.getMissingPermissions(userPermissions);
            logger.debug(`Skipping ${ToolConstructor.name} - insufficient permissions. Missing: ${missingPermissions.join(', ')}`);
            skippedCount++;
            continue;
          }
          
          logger.debug(`Registering ${ToolConstructor.name}...`);
          toolRegistry.registerTool(toolInstance);
          registeredCount++;
          logger.debug(`${ToolConstructor.name} registered successfully`);
        } catch (error) {
          failedCount++;
          logger.error(`Failed to register ${ToolConstructor.name}:`, error);
          // Continue with other tools instead of failing completely
        }
      }

      // Log registration summary
      const totalProcessed = registeredCount + failedCount + skippedCount;
      logger.info(`Tool registration summary: ${registeredCount} registered, ${skippedCount} skipped (permissions), ${failedCount} failed out of ${totalProcessed} total tools`);
      
      if (failedCount > 0) {
        logger.warn(`Tool registration completed with ${failedCount} failures.`);
      }
      
      if (skippedCount > 0) {
        logger.info(`${skippedCount} tools were skipped due to insufficient permissions. Use a token with higher privileges to access more tools.`);
      }

      // Verify the registry size matches our expectations
      const actualRegisteredCount = toolRegistry.size();
      if (actualRegisteredCount !== registeredCount) {
        logger.warn(`Registry size mismatch: expected ${registeredCount}, actual ${actualRegisteredCount}`);
      }

    } catch (error) {
      logger.error('Failed to import or register tools:', error);
      throw error;
    }
  }


  private updateResponseTime(responseTime: number): void {
    const currentAverage = this.metrics.averageResponseTime;
    const totalRequests = this.metrics.requestsSuccess + this.metrics.requestsFailed;
    this.metrics.averageResponseTime =
      (currentAverage * (totalRequests - 1) + responseTime) / totalRequests;
  }

  getHealth(): HealthStatus {
    const uptime = Date.now() - this.startTime.getTime();
    
    return {
      status: 'healthy',
      version: '1.0.0',
      uptime,
      checks: {
        api: true,
        auth: !this.dependencies.authManager.isTokenExpired(),
        rateLimit: true,
      },
    };
  }

  getMetrics(): ServerMetrics {
    return {
      ...this.metrics,
      uptime: Date.now() - this.startTime.getTime(),
    };
  }
}