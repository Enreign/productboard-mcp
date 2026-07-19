import { writeSync } from 'fs';
import pino, { Logger as PinoLogger } from 'pino';
import { LoggerConfig, LogLevel } from './types.js';
export { LogLevel };

// Synchronous stderr write — bypasses any buffering so the message is
// guaranteed to reach the parent process before process.exit().
export function writeStderrSync(line: string): void {
  try {
    writeSync(2, line.endsWith('\n') ? line : line + '\n');
  } catch {
    // last-resort fallback — stderr write itself failed, nothing more to do
  }
}

function formatFatalLine(message: string, error?: unknown): string {
  const ts = new Date().toISOString();
  let detail = '';
  if (error instanceof Error) {
    detail = ` — ${error.name}: ${error.message}`;
    if (error.stack && process.env.NODE_ENV !== 'production') {
      detail += `\n${error.stack}`;
    }
  } else if (error !== undefined && error !== null) {
    try {
      detail = ` — ${typeof error === 'string' ? error : JSON.stringify(error)}`;
    } catch {
      detail = ` — ${String(error)}`;
    }
  }
  return `[${ts}] FATAL productboard-mcp: ${message}${detail}`;
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
            name: error.name,
            ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
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
            name: error.name,
            ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
          },
        },
        message,
      );
    } else {
      this.pino.fatal(error, message);
    }
    // Pino writes are async; if the caller is about to process.exit(),
    // the buffered message can be lost (notably when Claude Desktop pipes
    // stderr). Mirror to stderr synchronously so failures are never silent.
    writeStderrSync(formatFatalLine(message, error));
  }

  child(bindings: Record<string, unknown>): Logger {
    const childPino = this.pino.child(bindings);
    const childLogger = Object.create(this);
    childLogger.pino = childPino;
    return childLogger;
  }
}