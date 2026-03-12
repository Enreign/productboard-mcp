import { readFileSync } from 'fs';
import { join } from 'path';
import type { Server as HttpServer } from 'http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

function getPackageVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
    return pkg.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}
const pkg = { version: getPackageVersion() };

import {
  ServerMetrics,
  HealthStatus,
} from './types.js';
import { MCPProtocolHandler } from './protocol.js';
import { ToolRegistry } from './registry.js';
import { AuthenticationManager } from '@auth/index.js';
import { AuthenticationType } from '@auth/types.js';
import { PermissionDiscoveryService } from '@auth/permission-discovery.js';
import { UserPermissions, AccessLevel } from '@auth/permissions.js';
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
  rateLimiter: RateLimiter;
  cache: CacheModule;
  protocolHandler: MCPProtocolHandler;
  permissionDiscovery: PermissionDiscoveryService;
  userPermissions?: UserPermissions;
}

export class ProductboardMCPServer {
  private server?: Server;
  private httpServer?: HttpServer;
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
        redirectUri: config.auth.redirectUri,
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
    const protocolHandler = new MCPProtocolHandler(toolRegistry, logger);
    const permissionDiscovery = new PermissionDiscoveryService(apiClient, logger);

    const dependencies: ServerDependencies = {
      config,
      logger,
      authManager,
      apiClient,
      toolRegistry,
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

      // Skip network operations in test mode to allow unit testing without API access
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

  async connectTransport(transport: SSEServerTransport): Promise<void> {
    if (!this.server) {
      throw new ServerError('Server not initialized');
    }
    await this.server.connect(transport);
  }

  async start(): Promise<void> {
    const { logger } = this.dependencies;

    if (!this.server) {
      throw new ServerError('Server not initialized');
    }

    try {
      logger.info('Starting Productboard MCP Server (stdio)...');
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      logger.info('Productboard MCP Server started successfully');
    } catch (error) {
      logger.fatal('Failed to start server', error);
      throw error;
    }
  }

  async startHttp(port: number, host: string): Promise<void> {
    const { logger } = this.dependencies;

    try {
      logger.info(`Starting Productboard MCP Server (HTTP) on ${host}:${port}...`);

      const app = express();
      app.use(express.json());

      // CORS — required for Claude web UI (claude.ai) and other browser-based MCP clients
      app.use((_req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, mcp-session-id');
        res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id');
        next();
      });
      app.options('/{*path}', (_req, res) => { res.sendStatus(204); });

      // Root endpoint — quick orientation for anyone hitting the base URL
      app.get('/', (_req, res) => {
        res.json({
          name: 'productboard-mcp',
          version: pkg.version,
          endpoints: {
            health: 'GET /health',
            mcp: 'POST /mcp  (StreamableHTTP, MCP protocol 2025-11-25)',
            sse: 'GET /sse   (SSE, MCP protocol 2024-11-05)',
          },
        });
      });

      // Health check endpoint for Railway and load balancers
      app.get('/health', (_req, res) => {
        res.json(this.getHealth());
      });

      // Modern StreamableHTTP transport endpoint (MCP protocol 2025-11-25).
      // A new MCP SDK Server + Transport is created per stateless request because the
      // SDK Server is single-use; shared state (metrics, tools, cache) lives on `this`.
      app.post('/mcp', async (req, res) => {
        const mcpServer = this.buildMCPServer();
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        try {
          await mcpServer.connect(transport);
          await transport.handleRequest(req, res, req.body);
          res.on('close', () => {
            void transport.close();
            void mcpServer.close();
          });
        } catch (error) {
          logger.error('Error handling MCP request', error);
          if (!res.headersSent) {
            res.status(500).json({
              jsonrpc: '2.0',
              error: { code: -32603, message: 'Internal server error' },
              id: null,
            });
          }
        }
      });

      // Legacy SSE transport endpoints (MCP protocol 2024-11-05, for older clients).
      // Sessions are keyed by the transport's session ID; entries are removed on close.
      const sseTransports: Record<string, { transport: SSEServerTransport; createdAt: number }> = {};

      // Periodically clean up any SSE sessions older than 2 hours in case close events
      // are not reliably delivered (e.g. ungraceful client disconnects).
      const SSE_SESSION_TTL_MS = 2 * 60 * 60 * 1000;
      const sseCleanupInterval = setInterval(() => {
        const now = Date.now();
        for (const [id, entry] of Object.entries(sseTransports)) {
          if (now - entry.createdAt > SSE_SESSION_TTL_MS) {
            delete sseTransports[id];
          }
        }
      }, 60 * 60 * 1000);
      sseCleanupInterval.unref();

      app.get('/sse', async (_req, res) => {
        const transport = new SSEServerTransport('/messages', res);
        const mcpServer = this.buildMCPServer();
        sseTransports[transport.sessionId] = { transport, createdAt: Date.now() };
        try {
          await mcpServer.connect(transport);
          res.on('close', () => {
            delete sseTransports[transport.sessionId];
            void mcpServer.close();
          });
        } catch (error) {
          logger.error('Error handling SSE connection', error);
          delete sseTransports[transport.sessionId];
          res.end();
        }
      });

      app.post('/messages', async (req, res) => {
        const sessionId = req.query['sessionId'] as string;
        const entry = sseTransports[sessionId];
        if (!entry) {
          res.status(404).json({ error: 'Session not found' });
          return;
        }
        await entry.transport.handlePostMessage(req, res);
      });

      await new Promise<void>((resolve, reject) => {
        this.httpServer = app.listen(port, host, () => {
          logger.info(`Productboard MCP Server listening on http://${host}:${port}`);
          logger.info(`  StreamableHTTP endpoint: http://${host}:${port}/mcp`);
          logger.info(`  SSE endpoint:            http://${host}:${port}/sse`);
          logger.info(`  Health check:            http://${host}:${port}/health`);
          resolve();
        });
        this.httpServer.on('error', reject);
      });
    } catch (error) {
      logger.fatal('Failed to start HTTP server', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    const { logger } = this.dependencies;

    try {
      logger.info('Stopping Productboard MCP Server...');

      if (this.httpServer) {
        await new Promise<void>((resolve) => {
          this.httpServer!.close(() => resolve());
        });
      }

      if (this.server) {
        await this.server.close();
      }

      logger.info('Productboard MCP Server stopped successfully');
    } catch (error) {
      logger.error('Error while stopping server', error);
      throw error;
    }
  }

  private buildMCPServer(): Server {
    const { logger, toolRegistry } = this.dependencies;

    const server = new Server(
      {
        name: 'productboard-mcp',
        version: pkg.version,
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    // Tools handlers
    // eslint-disable-next-line @typescript-eslint/require-await
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: toolRegistry.listTools(),
      };
    });

    // Tool execution handler
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
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

        const params = request.params as Record<string, unknown> | undefined;
        const toolName = params && typeof params.name === 'string' ? params.name : 'unknown';

        // For read-only tools, return a safe, non-throwing result to avoid 500s in clients
        try {
          const tool = this.dependencies.toolRegistry.getTool(toolName);
          if (tool && tool.permissionMetadata?.minimumAccessLevel === AccessLevel.READ) {
            const message = error instanceof Error ? error.message : (typeof error === 'string' ? error : 'Unknown error during tool execution');
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Error executing ${toolName}: ${String(message)}`,
                },
              ],
            };
          }
        } catch (lookupError) {
          // If tool lookup fails, fall through to standard error handling
        }

        // Re-throw with proper error handling for non-read tools or unknown cases
        if (error instanceof ProtocolError || error instanceof ToolExecutionError) {
          throw error;
        }

        throw new ToolExecutionError(
          error instanceof Error ? error.message : 'Unknown error during tool execution',
          toolName,
          error instanceof Error ? error : undefined
        );
      } finally {
        this.metrics.activeConnections--;
      }
    });

    return server;
  }

  private initializeMCPServer(): void {
    this.server = this.buildMCPServer();
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
      version: pkg.version,
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