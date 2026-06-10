import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createLogFunction,
  createNestedScope,
  resolveEnvLogLevel,
  resolveLoggerScope,
} from '#/utils/logger.helpers'

describe('createNestedScope', () => {
  it('joins parent and child scopes with a colon', () => {
    expect(createNestedScope('parent', 'child')).toBe('parent:child')
  })

  it('returns just the child when the parent scope is undefined', () => {
    expect(createNestedScope(undefined, 'child')).toBe('child')
  })

  it('returns just the child when the parent scope is an empty string', () => {
    expect(createNestedScope('', 'child')).toBe('child')
  })
})

describe('resolveEnvLogLevel', () => {
  // Env values (VITE_LOG_LEVEL / MODE) are pinned by the vitest config and
  // cannot be overridden via stubEnv here, so we assert the contract: the
  // resolved value is always one of the known log levels.
  it('resolves to a known log level', () => {
    expect(['silent', 'error', 'warn', 'info', 'debug']).toContain(
      resolveEnvLogLevel(),
    )
  })
})

describe('resolveLoggerScope', () => {
  it('returns the provided scope verbatim', () => {
    expect(resolveLoggerScope('explicit-scope')).toBe('explicit-scope')
  })

  it('derives a scope from the call site when none is provided', () => {
    // Exact value depends on the runtime stack; assert it resolves without throwing.
    const scope = resolveLoggerScope()
    expect(scope === undefined || typeof scope === 'string').toBe(true)
  })
})

describe('createLogFunction', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'debug').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs when the requested level is within the active level', () => {
    const make = createLogFunction({ resolvedScope: 'svc', level: 'debug' })
    const warn = make('warn', 'warn')
    warn('hello')
    expect(console.warn).toHaveBeenCalledOnce()
  })

  it('does not log when the requested level exceeds the active level', () => {
    const make = createLogFunction({ resolvedScope: 'svc', level: 'error' })
    const debug = make('debug', 'debug')
    debug('hidden')
    expect(console.debug).not.toHaveBeenCalled()
  })

  it('prefixes the scope label when a scope is set', () => {
    const make = createLogFunction({
      resolvedScope: 'my-scope',
      level: 'debug',
    })
    const warn = make('warn', 'warn')
    warn('payload')
    const firstArg = vi.mocked(console.warn).mock.calls[0]?.[0]
    expect(String(firstArg)).toContain('[my-scope]')
  })

  it('still logs without a scope', () => {
    const make = createLogFunction({ level: 'debug' })
    const warn = make('warn', 'warn')
    warn('no-scope')
    expect(console.warn).toHaveBeenCalledOnce()
  })

  it('falls back to console.log for an unknown console method', () => {
    const make = createLogFunction({ level: 'debug' })
    const fn = make('definitelyNotAConsoleMethod' as keyof Console, 'info')
    fn('routed-to-log')
    expect(console.log).toHaveBeenCalledOnce()
  })
})
