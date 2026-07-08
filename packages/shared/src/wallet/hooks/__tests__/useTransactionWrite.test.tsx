import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { logError } = vi.hoisted(() => ({ logError: vi.fn() }))
vi.mock('#/utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: logError,
  }),
}))

import { useTransactionWrite } from '../useTransactionWrite'

describe('useTransactionWrite', () => {
  beforeEach(() => {
    logError.mockClear()
  })

  it('starts idle', () => {
    const { result } = renderHook(() => useTransactionWrite())
    expect(result.current.isSubmitting).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.txDigest).toBeNull()
  })

  it('records the digest and runs onSuccess on success', async () => {
    const onSuccess = vi.fn()
    const { result } = renderHook(() => useTransactionWrite())

    let returned: string | null = 'unset'
    await act(async () => {
      returned = await result.current.run(async () => '0xdigest', {
        fallbackMessage: 'nope',
        onSuccess,
      })
    })

    expect(returned).toBe('0xdigest')
    expect(result.current.txDigest).toBe('0xdigest')
    expect(result.current.error).toBeNull()
    expect(result.current.isSubmitting).toBe(false)
    expect(onSuccess).toHaveBeenCalledWith('0xdigest')
    expect(logError).not.toHaveBeenCalled()
  })

  it('surfaces the Error message and does not run onSuccess on failure', async () => {
    const onSuccess = vi.fn()
    const { result } = renderHook(() => useTransactionWrite())

    let returned: string | null = 'unset'
    await act(async () => {
      returned = await result.current.run(
        async () => {
          throw new Error('boom')
        },
        { fallbackMessage: 'fallback', onSuccess },
      )
    })

    expect(returned).toBeNull()
    expect(result.current.error).toBe('boom')
    expect(result.current.txDigest).toBeNull()
    expect(result.current.isSubmitting).toBe(false)
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('uses fallbackMessage when the thrown value is not an Error', async () => {
    const { result } = renderHook(() => useTransactionWrite())

    await act(async () => {
      await result.current.run(
        async () => {
          throw 'a string, not an Error'
        },
        { fallbackMessage: 'fallback shown to user' },
      )
    })

    expect(result.current.error).toBe('fallback shown to user')
  })

  it('logs with logLabel when provided, else fallbackMessage', async () => {
    const { result } = renderHook(() => useTransactionWrite())

    await act(async () => {
      await result.current.run(
        async () => {
          throw new Error('x')
        },
        { fallbackMessage: 'fallback', logLabel: 'Explicit label' },
      )
    })
    expect(logError).toHaveBeenCalledWith('Explicit label', expect.anything())

    logError.mockClear()
    await act(async () => {
      await result.current.run(
        async () => {
          throw new Error('y')
        },
        { fallbackMessage: 'fallback only' },
      )
    })
    expect(logError).toHaveBeenCalledWith('fallback only', expect.anything())
  })

  it('resets a prior error and digest when a new run starts', async () => {
    const { result } = renderHook(() => useTransactionWrite())

    await act(async () => {
      await result.current.run(
        async () => {
          throw new Error('first failure')
        },
        { fallbackMessage: 'f' },
      )
    })
    expect(result.current.error).toBe('first failure')

    await act(async () => {
      await result.current.run(async () => '0xsecond', { fallbackMessage: 'f' })
    })
    expect(result.current.error).toBeNull()
    expect(result.current.txDigest).toBe('0xsecond')
  })

  it('ignores a second concurrent call while the first is still in flight', async () => {
    const execute = vi.fn().mockImplementation(
      () =>
        new Promise<string | null>((resolve) => {
          setTimeout(() => resolve('0xdigest'), 0)
        }),
    )
    const { result } = renderHook(() => useTransactionWrite())

    let first: string | null = 'unset'
    let second: string | null = 'unset'
    await act(async () => {
      const firstCall = result.current.run(execute, {
        fallbackMessage: 'fallback',
      })
      const secondCall = result.current.run(execute, {
        fallbackMessage: 'fallback',
      })
      ;[first, second] = await Promise.all([firstCall, secondCall])
    })

    expect(execute).toHaveBeenCalledTimes(1)
    expect(first).toBe('0xdigest')
    expect(second).toBeNull()
    expect(result.current.isSubmitting).toBe(false)
  })

  it('allows a new call once the prior run has finished', async () => {
    const { result } = renderHook(() => useTransactionWrite())

    await act(async () => {
      await result.current.run(async () => '0xfirst', {
        fallbackMessage: 'fallback',
      })
    })
    await act(async () => {
      await result.current.run(async () => '0xsecond', {
        fallbackMessage: 'fallback',
      })
    })

    expect(result.current.txDigest).toBe('0xsecond')
  })

  it('sets an error via setError without running a write', () => {
    const { result } = renderHook(() => useTransactionWrite())

    act(() => {
      result.current.setError('guard failed')
    })

    expect(result.current.error).toBe('guard failed')
    expect(result.current.txDigest).toBeNull()
    expect(result.current.isSubmitting).toBe(false)
  })
})
