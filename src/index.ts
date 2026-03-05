import { config } from 'dotenv';
import { ProductboardMCPServer } from '@core/server.js';
import { ConfigManager } from '@utils/config.js';
import { Logger } from '@utils/logger.js';

// Load environment variables
config();

async function main(): Promise<void> {
  const configManager = new ConfigManager();
  const configuration = configManager.get();
  
  const logger = new Logger({
    level: configuration.logLevel,
    pretty: configuration.logPretty,
  });

  try {
    // Validate configuration
    const validation = configManager.validate();
    if (!validation.valid) {
      logger.fatal('Configuration validation failed', { errors: validation.errors });
      process.exit(1);
    }

    // Create and initialize server
    const server = await ProductboardMCPServer.create(configuration);
    await server.initialize();

    // Handle shutdown signals
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

    // Start server - use HTTP transport when PORT is set (e.g. Railway deployment),
    // otherwise fall back to stdio transport for local MCP client use.
    const httpPort = process.env.PORT ? parseInt(process.env.PORT, 10) : null;
    if (httpPort) {
      await server.startHttp(httpPort, '0.0.0.0');
      logger.info('HTTP MCP server is running. Press Ctrl+C to stop.');
    } else {
      await server.start();
      logger.info('Stdio MCP server is running. Press Ctrl+C to stop.');
    }
  } catch (error) {
    logger.fatal('Server startup failed', error);
    process.exit(1);
  }
}

// Run main function
main().catch((error) => {
  process.stderr.write(`Unhandled error: ${error}\n`);
  process.exit(1);
});