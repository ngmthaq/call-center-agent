import { pino, type Logger } from 'pino';

import type { LogLevel } from './config';

const REDACT_PATHS = [
  'livekitApiSecret',
  'apiSecret',
  'api_secret',
  'LIVEKIT_API_SECRET',
  'token',
  'jwt',
  '*.livekitApiSecret',
  '*.apiSecret',
  '*.api_secret',
  '*.token',
  '*.jwt',
];

let rootLogger: Logger | undefined;

export interface LoggerOptions {
  readonly level?: LogLevel;
}

export function createLogger(name?: string, options: LoggerOptions = {}): Logger {
  if (!rootLogger) {
    rootLogger = pino({
      level: options.level ?? process.env.LOG_LEVEL ?? 'info',
      base: undefined,
      timestamp: pino.stdTimeFunctions.isoTime,
      redact: {
        paths: REDACT_PATHS,
        censor: '[REDACTED]',
        remove: false,
      },
      formatters: {
        level: (label) => ({ level: label }),
      },
    });
  }

  return name ? rootLogger.child({ name }) : rootLogger;
}

export function resetLoggerForTesting(): void {
  rootLogger = undefined;
}
