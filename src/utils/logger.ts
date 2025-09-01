/**
 * Simple logger utility for arbiter
 */

export interface Logger {
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}

class ConsoleLogger implements Logger {
  constructor(private readonly prefix: string = 'arbiter') {}

  info(message: string, ...args: any[]): void {
    console.info(`[${this.prefix}] INFO: ${message}`, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`[${this.prefix}] WARN: ${message}`, ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(`[${this.prefix}] ERROR: ${message}`, ...args);
  }

  debug(message: string, ...args: any[]): void {
    if (process.env.DEBUG || process.env.NODE_ENV === 'development') {
      console.debug(`[${this.prefix}] DEBUG: ${message}`, ...args);
    }
  }
}

export const logger = new ConsoleLogger('arbiter');
export default logger;