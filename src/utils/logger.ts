import pino, { Logger as PinoLogger } from 'pino';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LoggerConfig {
  level: LogLevel;
  pretty?: boolean;
  name?: string;
}

export class Logger {
  private pino: PinoLogger;

  constructor(config: LoggerConfig) {
    const options: pino.LoggerOptions = {
      level: config.level,
      name: config.name || 'productboard-mcp',
    };

    if (config.pretty && process.env.NODE_ENV !== 'production') {
      this.pino = pino({
        ...options,
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }, process.stderr);
    } else {
      this.pino = pino(options, process.stderr);
    }
  }

  trace(message: string, data?: unknown): void {
    this.pino.trace(data, message);
  }

  debug(message: string, data?: unknown): void {
    this.pino.debug(data, message);
  }

  info(message: string, data?: unknown): void {
    this.pino.info(data, message);
  }

  warn(message: string, data?: unknown): void {
    this.pino.warn(data, message);
  }

  error(message: string, error?: unknown): void {
    if (error instanceof Error) {
      this.pino.error(
        {
          err: {
            message: error.message,
            stack: error.stack,
            name: error.name,
          },
        },
        message,
      );
    } else {
      this.pino.error(error, message);
    }
  }

  fatal(message: string, error?: unknown): void {
    if (error instanceof Error) {
      this.pino.fatal(
        {
          err: {
            message: error.message,
            stack: error.stack,
            name: error.name,
          },
        },
        message,
      );
    } else {
      this.pino.fatal(error, message);
    }
  }

  child(bindings: Record<string, unknown>): Logger {
    const childPino = this.pino.child(bindings);
    const childLogger = Object.create(this);
    childLogger.pino = childPino;
    return childLogger;
  }
}