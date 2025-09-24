/**
 * Development logging utility with configurable levels and quiet mode
 *
 * Usage:
 * 1. Import: import { createLogger } from './utils/logger';
 * 2. Create: const log = createLogger('ComponentName');
 * 3. Use: log.info('Message', data);
 *
 * Log levels (set via VITE_LOG_LEVEL in .env.development):
 * - SILENT (0): No output
 * - ERROR (1): Only errors
 * - WARN (2): Errors and warnings
 * - INFO (3): Errors, warnings, and info (default for quiet dev)
 * - DEBUG (4): Verbose debugging
 * - TRACE (5): Extremely verbose (render state, ping/pong, etc.)
 *
 * Runtime control (in browser console):
 * - __arbiterLogger.setLevel('DEBUG') or __arbiterLogger.setLevel(4)
 * - __arbiterLogger.current() - shows current level
 */

export const LogLevel = {
  SILENT: 0,
  ERROR: 1,
  WARN: 2,
  INFO: 3,
  DEBUG: 4,
  TRACE: 5,
} as const;

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

export const LogLevelNames = {
  [LogLevel.SILENT]: 'SILENT',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.TRACE]: 'TRACE',
} as const;

export interface LoggerConfig {
  level: LogLevel;
  enableColors: boolean;
  enableTimestamps: boolean;
}

class Logger {
  public config: LoggerConfig = {
    level: this.getDefaultLogLevel(),
    enableColors: true,
    enableTimestamps: false,
  };

  private getDefaultLogLevel(): LogLevel {
    // Check environment variables
    const envLevel = import.meta.env.VITE_LOG_LEVEL;
    if (envLevel) {
      const level = LogLevel[envLevel.toUpperCase() as keyof typeof LogLevel];
      if (level !== undefined) return level;
    }

    // Default to INFO in development, WARN in production
    return import.meta.env.DEV ? LogLevel.INFO : LogLevel.WARN;
  }

  setLevel(level: LogLevel) {
    this.config.level = level;
  }

  setConfig(config: Partial<LoggerConfig>) {
    this.config = { ...this.config, ...config };
  }

  private formatMessage(
    level: string,
    category: string,
    message: string,
    ...args: any[]
  ): [string, ...any[]] {
    const parts = [];

    if (this.config.enableTimestamps) {
      parts.push(new Date().toISOString().substring(11, 23));
    }

    if (this.config.enableColors) {
      const colors = {
        ERROR: '\x1b[31m', // red
        WARN: '\x1b[33m', // yellow
        INFO: '\x1b[36m', // cyan
        DEBUG: '\x1b[32m', // green
        TRACE: '\x1b[35m', // magenta
        RESET: '\x1b[0m',
      };
      parts.push(`${colors[level as keyof typeof colors] || ''}[${level}]${colors.RESET}`);
    } else {
      parts.push(`[${level}]`);
    }

    if (category) {
      parts.push(`[${category}]`);
    }

    parts.push(message);

    return [parts.join(' '), ...args];
  }

  error(category: string, message: string, ...args: any[]) {
    if (this.config.level >= LogLevel.ERROR) {
      console.error(...this.formatMessage('ERROR', category, message, ...args));
    }
  }

  warn(category: string, message: string, ...args: any[]) {
    if (this.config.level >= LogLevel.WARN) {
      console.warn(...this.formatMessage('WARN', category, message, ...args));
    }
  }

  info(category: string, message: string, ...args: any[]) {
    if (this.config.level >= LogLevel.INFO) {
      console.info(...this.formatMessage('INFO', category, message, ...args));
    }
  }

  debug(category: string, message: string, ...args: any[]) {
    if (this.config.level >= LogLevel.DEBUG) {
      console.log(...this.formatMessage('DEBUG', category, message, ...args));
    }
  }

  trace(category: string, message: string, ...args: any[]) {
    if (this.config.level >= LogLevel.TRACE) {
      console.log(...this.formatMessage('TRACE', category, message, ...args));
    }
  }

  // Convenience methods for common logging patterns
  wsEvent(event: any) {
    this.debug('WebSocket', 'Event received:', event);
  }

  wsConnection(status: 'connected' | 'disconnected' | 'reconnecting', details?: any) {
    this.info('WebSocket', `Connection ${status}`, details);
  }

  wsError(message: string, error?: any) {
    this.error('WebSocket', message, error);
  }

  appInit(step: string, data?: any) {
    this.debug('App', `Initialization: ${step}`, data);
  }

  editorSetup(message: string, data?: any) {
    this.debug('Editor', message, data);
  }

  apiRequest(method: string, url: string, data?: any) {
    this.trace('API', `${method.toUpperCase()} ${url}`, data);
  }

  apiResponse(method: string, url: string, status: number, data?: any) {
    if (status >= 400) {
      this.error('API', `${method.toUpperCase()} ${url} - ${status}`, data);
    } else {
      this.trace('API', `${method.toUpperCase()} ${url} - ${status}`, data);
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export convenience function to create category-specific loggers
export function createLogger(category: string) {
  return {
    error: (message: string, ...args: any[]) => logger.error(category, message, ...args),
    warn: (message: string, ...args: any[]) => logger.warn(category, message, ...args),
    info: (message: string, ...args: any[]) => logger.info(category, message, ...args),
    debug: (message: string, ...args: any[]) => logger.debug(category, message, ...args),
    trace: (message: string, ...args: any[]) => logger.trace(category, message, ...args),
  };
}

// Export types
export type CategoryLogger = ReturnType<typeof createLogger>;

// Development helper: Add to window object for runtime control
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as any).__arbiterLogger = {
    setLevel: (level: string | number) => {
      const logLevel =
        typeof level === 'string' ? LogLevel[level.toUpperCase() as keyof typeof LogLevel] : level;
      if (logLevel !== undefined) {
        logger.setLevel(logLevel as LogLevel);
        console.log(`Log level set to: ${LogLevelNames[logLevel as LogLevel]}`);
      }
    },
    levels: LogLevel,
    current: () => LogLevelNames[logger.config.level],
  };
}
