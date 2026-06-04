import {
  createLogFunction,
  createNestedScope,
  resolveEnvLogLevel,
  resolveLoggerScope,
} from './logger.helpers'
import type { CreateLoggerOptions, Logger } from './logger.types'

const ENV_LOG_LEVEL = resolveEnvLogLevel()

/**
 * Create a logger scoped to the current module. If no scope is provided, the
 * logger automatically derives the filename (plus parent folder) from the call
 * site so logs stay consistent without manual strings.
 */
export const createLogger = ({
  scope,
  level = ENV_LOG_LEVEL,
}: CreateLoggerOptions = {}): Logger => {
  const resolvedScope = resolveLoggerScope(scope)
  const log = createLogFunction({ resolvedScope, level })

  return {
    debug: log('debug', 'debug'),
    info: log('info', 'info'),
    warn: log('warn', 'warn'),
    error: log('error', 'error'),
    child: (childScope: string) =>
      createLogger({
        scope: createNestedScope(resolvedScope, childScope),
        level,
      }),
  }
}

/**
 * Default logger instance scoped to the application root. Prefer using
 * module-level loggers (via `createLogger()`) for better call-site context.
 */
export const logger = createLogger()

export type { CreateLoggerOptions, Logger, LogLevel } from './logger.types'
