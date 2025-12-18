export type LogLevel = "silent" | "error" | "warn" | "info" | "debug";

export type GlobalProcess = {
  env?: Record<string, string | undefined>;
  cwd?: () => string;
};

export type GlobalWithProcess = typeof globalThis & {
  process?: GlobalProcess;
};

export interface StackFrame {
  filePath: string;
  lineNumber?: number;
  columnNumber?: number;
}

export type LoggerFn = (...args: unknown[]) => void;

export interface Logger {
  debug: LoggerFn;
  info: LoggerFn;
  warn: LoggerFn;
  error: LoggerFn;
  /**
   * Create a scoped logger that inherits the current options.
   */
  child: (scope: string) => Logger;
}

export interface CreateLoggerOptions {
  scope?: string;
  level?: LogLevel;
}
