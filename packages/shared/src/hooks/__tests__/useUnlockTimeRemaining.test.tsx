import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** Advances fake timers inside act() so resolved-promise state updates commit. */
const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })

vi.mock('#/services/vaultService', () => ({
  ephKeyService: { getUnlockRemainingMs: vi.fn() },
}))
vi.mock('#/utils/environment', () => ({ isWeb: vi.fn() }))

import { useUnlockTimeRemaining } from '#/hooks/useUnlockTimeRemaining'
import { ephKeyService } from '#/services/vaultService'
import { isWeb } from '#/utils/environment'

describe('useUnlockTimeRemaining', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(ephKeyService.getUnlockRemainingMs).mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null when disabled and never queries', async () => {
    vi.mocked(isWeb).mockReturnValue(true)
    const { result } = renderHook(() => useUnlockTimeRemaining(false))
    await advance(0)

    expect(result.current).toBeNull()
    expect(ephKeyService.getUnlockRemainingMs).not.toHaveBeenCalled()
  })

  it('formats the remaining time as m:ss (web)', async () => {
    vi.mocked(isWeb).mockReturnValue(true)
    vi.mocked(ephKeyService.getUnlockRemainingMs).mockResolvedValue(90_000)

    const { result } = renderHook(() => useUnlockTimeRemaining(true))
    await advance(0)

    expect(result.current).toBe('1:30')
  })

  it('returns null when the window has elapsed (web)', async () => {
    vi.mocked(isWeb).mockReturnValue(true)
    vi.mocked(ephKeyService.getUnlockRemainingMs).mockResolvedValue(0)

    const { result } = renderHook(() => useUnlockTimeRemaining(true))
    await advance(0)

    expect(result.current).toBeNull()
  })

  it('queries once and counts down locally (extension)', async () => {
    vi.mocked(isWeb).mockReturnValue(false)
    vi.mocked(ephKeyService.getUnlockRemainingMs).mockResolvedValue(60_000)

    const { result } = renderHook(() => useUnlockTimeRemaining(true))
    await advance(0)
    expect(result.current).toBe('1:00')

    await advance(1000)
    expect(result.current).toBe('0:59')

    // Single keeper query — the rest is a local countdown.
    expect(ephKeyService.getUnlockRemainingMs).toHaveBeenCalledTimes(1)
  })
})
