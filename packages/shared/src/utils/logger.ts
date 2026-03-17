import type {
  CreateLoggerOptions,
  GlobalProcess,
  GlobalWithProcess,
  Logger,
  LoggerFn,
  LogLevel,
  StackFrame,
} from "./logger.types";

const LOG_LEVELS: LogLevel[] = ["silent", "error", "warn", "info", "debug"];
const LOGGER_SOURCE_HINTS = ["logger.ts", "logger.js", "logger.mjs"];

const isLogLevel = (value?: string | null): value is LogLevel => {
  if (!value) {
    return false;
  }

  return LOG_LEVELS.includes(value.toLowerCase() as LogLevel);
};

const getImportMetaEnv = (): Record<string, string> | undefined => {
  try {
    return typeof import.meta !== "undefined"
      ? ((
          import.meta as ImportMeta & {
            env?: Record<string, string>;
          }
        ).env ?? undefined)
      : undefined;
  } catch {
    return undefined;
  }
};

const getProcessObject = (): GlobalProcess | undefined => {
  try {
    return (globalThis as GlobalWithProcess).process;
  } catch {
    return undefined;
  }
};

const getProcessEnv = (): Record<string, string | undefined> | undefined => {
  return getProcessObject()?.env;
};

const resolveEnvLogLevel = (): LogLevel => {
  const importMetaEnv = getImportMetaEnv();
  const processEnv = getProcessEnv();

  const explicitLevel =
    importMetaEnv?.VITE_LOG_LEVEL ??
    importMetaEnv?.MODE ??
    processEnv?.EVE_VAULT_LOG_LEVEL ??
    processEnv?.LOG_LEVEL ??
    processEnv?.NODE_ENV;

  if (isLogLevel(explicitLevel)) {
    return explicitLevel;
  }

  const envMode = importMetaEnv?.MODE ?? processEnv?.NODE_ENV;

  if (envMode === "production") {
    return "error";
  }

  if (envMode === "test") {
    return "warn";
  }

  return "debug";
};

const normalizeSeparators = (path: string): string => {
  return path.replace(/\\/g, "/");
};

const stripOrigin = (path: string): string => {
  if (typeof window !== "undefined" && window.location?.origin) {
    return path.replace(window.location.origin, "");
  }

  return path;
};

const stripWorkspaceRoot = (path: string): string => {
  try {
    const globalProcess = getProcessObject();
    if (globalProcess && typeof globalProcess.cwd === "function") {
      const cwd = normalizeSeparators(globalProcess.cwd());
      if (path.startsWith(cwd)) {
        return path.slice(cwd.length);
      }
    }
  } catch {
    // Ignore if process is unavailable
  }
  return path;
};

const sanitizeFilePath = (path: string): string => {
  if (!path) {
    return "";
  }

  let cleaned = normalizeSeparators(path);
  cleaned = cleaned.replace(
    /^webpack-internal:\/\/\/|^vite:\/\/|^file:\/\//,
    "",
  );
  cleaned = stripOrigin(cleaned);
  cleaned = stripWorkspaceRoot(cleaned);
  cleaned = cleaned.split(/[?#]/)[0];
  return cleaned;
};

const parseStackLine = (line: string): StackFrame | undefined => {
  const match = line.match(/(?:\()?(.*?):(\d+):(\d+)\)?$/);
  if (!match) {
    return undefined;
  }

  const [, rawPath, lineNumber, columnNumber] = match;
  return {
    filePath: rawPath,
    lineNumber: Number(lineNumber),
    columnNumber: Number(columnNumber),
  };
};

const captureStack = (): string | undefined => {
  try {
    return new Error().stack;
  } catch {
    return undefined;
  }
};

const getCallerFrameFromStack = (stack?: string): StackFrame | undefined => {
  if (!stack) {
    return undefined;
  }

  const lines = stack.split("\n").slice(1);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (
      !line ||
      LOGGER_SOURCE_HINTS.some((hint) => line.includes(hint)) ||
      line.includes("node:internal")
    ) {
      continue;
    }

    const frame = parseStackLine(line);
    if (frame) {
      return frame;
    }
  }

  return undefined;
};

const deriveScopeFromPath = (filePath?: string): string | undefined => {
  if (!filePath) {
    return undefined;
  }

  const cleaned = sanitizeFilePath(filePath);
  const segments = cleaned.split("/").filter(Boolean);

  if (segments.length === 0) {
    return undefined;
  }

  const fileName = segments.pop();
  if (!fileName) {
    return undefined;
  }
  const parent = segments.pop();
  const baseName = fileName.replace(/\.[^.]+$/, "");

  return parent ? `${parent}/${baseName}` : baseName;
};

const getLocationLabel = (frame?: StackFrame): string | undefined => {
  if (!frame?.filePath) {
    return undefined;
  }

  const cleaned = sanitizeFilePath(frame.filePath);
  const parts = cleaned.split("/").filter(Boolean);
  const shortPath =
    parts.length > 2 ? parts.slice(-2).join("/") : parts.join("/") || cleaned;

  if (!shortPath) {
    return undefined;
  }

  if (frame.lineNumber) {
    return `${shortPath}:${frame.lineNumber}`;
  }

  return shortPath;
};

const resolveLoggerScope = (providedScope?: string): string | undefined => {
  if (providedScope) {
    return providedScope;
  }

  const frame = getCallerFrameFromStack(captureStack());
  return deriveScopeFromPath(frame?.filePath);
};

const ENV_LOG_LEVEL = resolveEnvLogLevel();

const shouldLog = (
  requestedLevel: LogLevel,
  activeLevel: LogLevel,
): boolean => {
  return LOG_LEVELS.indexOf(requestedLevel) <= LOG_LEVELS.indexOf(activeLevel);
};

/**
 * Create a logger scoped to the current module. If no scope is provided, the
 * logger automatically derives the filename (plus parent folder) from the call
 * site so logs stay consistent without manual strings.
 */
export const createLogger = ({
  scope,
  level = ENV_LOG_LEVEL,
}: CreateLoggerOptions = {}): Logger => {
  const resolvedScope = resolveLoggerScope(scope);

  const log =
    (consoleMethod: keyof Console, logLevel: LogLevel): LoggerFn =>
    (...args: unknown[]) => {
      if (!shouldLog(logLevel, level)) {
        return;
      }

      const method = (console?.[consoleMethod] ?? console.log) as (
        ...args: unknown[]
      ) => void;
      if (!method) {
        return;
      }

      const frame = getCallerFrameFromStack(captureStack());
      const locationScopeCandidate = deriveScopeFromPath(frame?.filePath);
      const shouldShowResolvedScope =
        resolvedScope &&
        (!locationScopeCandidate || locationScopeCandidate !== resolvedScope);

      const scopeLabel = shouldShowResolvedScope ? resolvedScope : undefined;
      const locationLabel = getLocationLabel(frame);

      const prefixParts: string[] = [];
      if (scopeLabel) {
        prefixParts.push(`[${scopeLabel}]`);
      }
      if (locationLabel) {
        prefixParts.push(`(${locationLabel})`);
      }

      const finalArgs =
        prefixParts.length > 0
          ? ([prefixParts.join(" "), ...args] as unknown[])
          : args;

      method.apply(console, finalArgs);
    };

  return {
    debug: log("debug", "debug"),
    info: log("info", "info"),
    warn: log("warn", "warn"),
    error: log("error", "error"),
    child: (childScope: string) => {
      const nestedScope =
        resolvedScope && resolvedScope.length > 0
          ? `${resolvedScope}:${childScope}`
          : childScope;
      return createLogger({ scope: nestedScope, level });
    },
  };
};

/**
 * Default logger instance scoped to the application root. Prefer using
 * module-level loggers (via `createLogger()`) for better call-site context.
 */
export const logger = createLogger();

export type { CreateLoggerOptions, Logger, LogLevel } from "./logger.types";
