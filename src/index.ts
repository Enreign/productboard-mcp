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

    // Run HTTP server startup and initialization concurrently.
    // startHttp() binds the port immediately (Railway /health passes right away).
    // initialize() validates auth, connects to the API, and registers tools in parallel.
    // Promise.all resolves once both are settled, guaranteeing tools are ready before
    // the first MCP client connects.
    const port = parseInt(process.env.PORT || String(configuration.server.port), 10);
    await Promise.all([
      server.startHttp(port, configuration.server.host),
      server.initialize().catch((error: unknown) => {
        logger.error('Initialization failed — server running in degraded mode', error);
      }),
    ]);

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