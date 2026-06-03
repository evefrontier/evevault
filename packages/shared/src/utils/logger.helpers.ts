import type {
  GlobalProcess,
  GlobalWithProcess,
  LoggerFn,
  LogLevel,
  StackFrame,
} from './logger.types'

const LOG_LEVELS: LogLevel[] = ['silent', 'error', 'warn', 'info', 'debug']
const LOGGER_SOURCE_HINTS = ['logger.ts', 'logger.js', 'logger.mjs']
const MODE_LOG_LEVELS: Partial<Record<string, LogLevel>> = {
  production: 'error',
  test: 'warn',
}
const PATH_PREFIX_PATTERN = /^webpack-internal:\/\/\/|^vite:\/\/|^file:\/\//
const URL_SUFFIX_PATTERN = /[?#]/

type CreateLoggerFnOptions = {
  resolvedScope?: string
  level: LogLevel
}

export const resolveEnvLogLevel = (): LogLevel => {
  const importMetaEnv = getImportMetaEnv()
  const processEnv = getProcessEnv()
  const explicitLevel =
    importMetaEnv?.VITE_LOG_LEVEL ??
    importMetaEnv?.MODE ??
    processEnv?.EVE_VAULT_LOG_LEVEL ??
    processEnv?.LOG_LEVEL ??
    processEnv?.NODE_ENV

  if (isLogLevel(explicitLevel)) {
    return explicitLevel
  }

  return resolveModeLogLevel(importMetaEnv?.MODE ?? processEnv?.NODE_ENV)
}

export const resolveLoggerScope = (
  providedScope?: string,
): string | undefined => {
  return providedScope ?? deriveScopeFromPath(getCallerFrame()?.filePath)
}

export const createLogFunction =
  ({ resolvedScope, level }: CreateLoggerFnOptions) =>
  (consoleMethod: keyof Console, logLevel: LogLevel): LoggerFn =>
  (...args: unknown[]) => {
    const method = resolveConsoleMethod(consoleMethod)
    if (shouldLog(logLevel, level)) {
      method.apply(console, getLogArgs(resolvedScope, args))
    }
  }

export const createNestedScope = (
  resolvedScope: string | undefined,
  childScope: string,
): string => {
  return resolvedScope && resolvedScope.length > 0
    ? `${resolvedScope}:${childScope}`
    : childScope
}

const isLogLevel = (value?: string | null): value is LogLevel => {
  return LOG_LEVELS.includes((value ?? '').toLowerCase() as LogLevel)
}

const resolveModeLogLevel = (envMode?: string): LogLevel => {
  return MODE_LOG_LEVELS[envMode ?? ''] ?? 'debug'
}

const shouldLog = (
  requestedLevel: LogLevel,
  activeLevel: LogLevel,
): boolean => {
  return LOG_LEVELS.indexOf(requestedLevel) <= LOG_LEVELS.indexOf(activeLevel)
}

const getImportMetaEnv = (): Record<string, string> | undefined => {
  try {
    return typeof import.meta !== 'undefined'
      ? ((
          import.meta as ImportMeta & {
            env?: Record<string, string>
          }
        ).env ?? undefined)
      : undefined
  } catch {
    return undefined
  }
}

const getProcessObject = (): GlobalProcess | undefined => {
  try {
    return (globalThis as GlobalWithProcess).process
  } catch {
    return undefined
  }
}

const getProcessEnv = (): Record<string, string | undefined> | undefined => {
  return getProcessObject()?.env
}

const normalizeSeparators = (path: string): string => {
  return path.replace(/\\/g, '/')
}

const stripOrigin = (path: string): string => {
  return path.replace(globalThis.window?.location?.origin ?? '', '')
}

const stripWorkspaceRoot = (path: string): string => {
  try {
    const globalProcess = getProcessObject()
    if (typeof globalProcess?.cwd === 'function') {
      const cwd = normalizeSeparators(globalProcess.cwd())
      return path.startsWith(cwd) ? path.slice(cwd.length) : path
    }
  } catch {
    // Ignore if process is unavailable
  }
  return path
}

const sanitizeFilePath = (path: string): string => {
  const cleaned = normalizeSeparators(path).replace(PATH_PREFIX_PATTERN, '')
  return stripWorkspaceRoot(stripOrigin(cleaned)).split(URL_SUFFIX_PATTERN)[0]
}

const parseStackLine = (line: string): StackFrame | undefined => {
  const match = line.match(/(?:\()?(.*?):(\d+):(\d+)\)?$/)
  if (!match) {
    return undefined
  }

  const [, rawPath, lineNumber, columnNumber] = match
  return {
    filePath: rawPath,
    lineNumber: Number(lineNumber),
    columnNumber: Number(columnNumber),
  }
}

const captureStack = (): string | undefined => {
  try {
    return new Error().stack
  } catch {
    return undefined
  }
}

const getCallerFrameFromStack = (stack?: string): StackFrame | undefined => {
  return stack?.split('\n').slice(1).map(parseCallerStackLine).find(Boolean)
}

const parseCallerStackLine = (rawLine: string): StackFrame | undefined => {
  const line = rawLine.trim()
  return isApplicationStackLine(line) ? parseStackLine(line) : undefined
}

const deriveScopeFromPath = (filePath?: string): string | undefined => {
  return filePath ? scopeFromSegments(pathSegments(filePath)) : undefined
}

const getLocationLabel = (frame?: StackFrame): string | undefined => {
  const shortPath = frame?.filePath ? compactPath(frame.filePath) : ''
  return shortPath && frame?.lineNumber
    ? `${shortPath}:${frame.lineNumber}`
    : shortPath || undefined
}

const resolveConsoleMethod = (
  consoleMethod: keyof Console,
): ((...args: unknown[]) => void) => {
  return (console?.[consoleMethod] ?? console.log) as (
    ...args: unknown[]
  ) => void
}

const getLogArgs = (
  resolvedScope: string | undefined,
  args: unknown[],
): unknown[] => {
  const frame = getCallerFrame()
  const prefix = buildLogPrefix(resolvedScope, frame)
  return prefix ? [prefix, ...args] : args
}

const buildLogPrefix = (
  resolvedScope: string | undefined,
  frame?: StackFrame,
): string | undefined => {
  const locationScopeCandidate = deriveScopeFromPath(frame?.filePath)
  const scopeLabel = shouldShowScope(resolvedScope, locationScopeCandidate)
    ? `[${resolvedScope}]`
    : ''
  const locationLabel = formatLocationLabel(getLocationLabel(frame))
  return [scopeLabel, locationLabel].filter(Boolean).join(' ') || undefined
}

const getCallerFrame = (): StackFrame | undefined => {
  return getCallerFrameFromStack(captureStack())
}

const isApplicationStackLine = (line: string): boolean => {
  return (
    Boolean(line) &&
    !LOGGER_SOURCE_HINTS.some((hint) => line.includes(hint)) &&
    !line.includes('node:internal')
  )
}

const pathSegments = (filePath: string): string[] => {
  return sanitizeFilePath(filePath).split('/').filter(Boolean)
}

const scopeFromSegments = (segments: string[]): string | undefined => {
  const fileName = segments[segments.length - 1]
  const parent = segments[segments.length - 2]
  const baseName = fileName?.replace(/\.[^.]+$/, '')
  return baseName && parent ? `${parent}/${baseName}` : baseName
}

const compactPath = (filePath: string): string => {
  const cleaned = sanitizeFilePath(filePath)
  const parts = cleaned.split('/').filter(Boolean)
  return (parts.length > 2 ? parts.slice(-2) : parts).join('/') || cleaned
}

const shouldShowScope = (
  resolvedScope: string | undefined,
  locationScopeCandidate: string | undefined,
): boolean => {
  return Boolean(
    resolvedScope &&
      (!locationScopeCandidate || locationScopeCandidate !== resolvedScope),
  )
}

const formatLocationLabel = (locationLabel?: string): string => {
  return locationLabel ? `(${locationLabel})` : ''
}
