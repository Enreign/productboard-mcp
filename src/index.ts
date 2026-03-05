import { config } from 'dotenv';
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

    // Always bind to all interfaces so Railway (and other cloud platforms) can
    // route external traffic into the container.  PORT comes from the platform;
    // fall back to the value from config or 3000.  HOST defaults to '0.0.0.0'
    // (see config.ts) and can be overridden via MCP_SERVER_HOST.
    const port = parseInt(process.env.PORT || String(configuration.server.port), 10);
    await server.startHttp(port, configuration.server.host);

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

    process.on('SIGINT', () => { void shutdown('SIGINT'); });
    process.on('SIGTERM', () => { void shutdown('SIGTERM'); });

  } catch (error) {
    logger.fatal('Server startup failed', error);
    process.exit(1);
  }
}

main().catch((error) => {
  process.stderr.write(`Unhandled error: ${error}\n`);
  process.exit(1);
});