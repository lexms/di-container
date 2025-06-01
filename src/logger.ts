export interface Logger {
  trace(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export class ConsoleLogger implements Logger {
  constructor(private readonly prefix: string = 'DIContainer') {}

  trace(message: string, ...args: unknown[]): void {
    console.debug(`[${this.prefix}] TRACE: ${message}`, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    console.debug(`[${this.prefix}] DEBUG: ${message}`, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    console.info(`[${this.prefix}] INFO: ${message}`, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(`[${this.prefix}] WARN: ${message}`, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    console.error(`[${this.prefix}] ERROR: ${message}`, ...args);
  }
}

export class NoOpLogger implements Logger {
  trace(): void {
    // No-op
  }

  debug(): void {
    // No-op
  }

  info(): void {
    // No-op
  }

  warn(): void {
    // No-op
  }

  error(): void {
    // No-op
  }
}

export function createLogger(enableLogging: boolean, prefix?: string): Logger {
  return enableLogging ? new ConsoleLogger(prefix) : new NoOpLogger();
} 