import { config } from 'dotenv';
import express from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { ProductboardMCPServer } from '@core/server.js';
import { ConfigManager } from '@utils/config.js';
import { Logger } from '@utils/logger.js';

config();

async function main(): Promise<void> {
  const configManager = new ConfigManager();
  const configuration = configManager.get();
  const logger = new Logger({
    level: configuration.logLevel,
    pretty: configuration.logPretty,
  });

  try {
    const validation = configManager.validate();
    if (!validation.valid) {
      logger.fatal('Configuration validation failed', { errors: validation.errors });
      process.exit(1);
    }

    const server = await ProductboardMCPServer.create(configuration);
    await server.initialize();

    // --- RAILWAY/SSE WRAPPER START ---
    const app = express();
    app.use(express.json());

    // Health check endpoint required by Railway
    app.get('/health', (_req, res) => {
      res.json(server.getHealth());
    });

    // Track active SSE connections by session ID, along with creation timestamp
    // for TTL-based cleanup of abandoned sessions.
    const SSE_SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
    const transports: Record<string, { transport: SSEServerTransport; createdAt: number }> = {};

    const sseCleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [id, entry] of Object.entries(transports)) {
        if (now - entry.createdAt > SSE_SESSION_TTL_MS) {
          delete transports[id];
        }
      }
    }, 60 * 60 * 1000);
    sseCleanupInterval.unref();

    // 1. Connection Endpoint: establishes the SSE stream for each client
    app.get('/sse', async (_req, res) => {
      logger.info('New SSE connection request received');

      const transport = new SSEServerTransport('/messages', res);
      transports[transport.sessionId] = { transport, createdAt: Date.now() };

      res.on('close', () => {
        logger.info(`Session ${transport.sessionId} closed`);
        delete transports[transport.sessionId];
      });

      // Connect the MCP server instance to this transport session
      await server.connectTransport(transport);
    });

    // 2. Message Endpoint: receives JSON-RPC commands from the client
    app.post('/messages', async (req, res) => {
      const sessionId = req.query['sessionId'] as string;
      const entry = transports[sessionId];

      if (!entry) {
        res.status(404).send(`Session not found: ${sessionId}`);
        return;
      }

      await entry.transport.handlePostMessage(req, res);
    });

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      logger.info(`Productboard MCP Server is running on port ${PORT}`);
      const publicDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
      const sseUrl = publicDomain
        ? `https://${publicDomain}/sse`
        : `http://localhost:${PORT}/sse`;
      logger.info(`SSE Endpoint: ${sseUrl}`);
    });
    // --- RAILWAY/SSE WRAPPER END ---

    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      try {
        await server.stop();
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (error) {
    logger.fatal('Server startup failed', error);
    process.exit(1);
  }
}

main().catch((error) => {
  process.stderr.write(`Unhandled error: ${error}\n`);
  process.exit(1);
});