/**
 * Structured JSON logger for all services.
 * Wraps console with JSON output including service name, timestamp, and trace ID.
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  traceId?: string;
  data?: Record<string, unknown>;
}

export interface LoggerOptions {
  serviceName: string;
  defaultTraceId?: string;
}

export class Logger {
  private serviceName: string;
  private traceId?: string;

  constructor(options: LoggerOptions) {
    this.serviceName = options.serviceName;
    this.traceId = options.defaultTraceId;
  }

  setTraceId(traceId: string): void {
    this.traceId = traceId;
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, data);
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      message,
      ...(this.traceId && { traceId: this.traceId }),
      ...(data && { data }),
    };

    const json = JSON.stringify(entry);

    switch (level) {
      case LogLevel.ERROR:
        console.error(json);
        break;
      case LogLevel.WARN:
        console.warn(json);
        break;
      case LogLevel.DEBUG:
        console.debug(json);
        break;
      default:
        console.log(json);
    }
  }
}
