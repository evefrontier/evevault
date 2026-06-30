import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('#/stores/deviceStore', () => ({ useDeviceStore: vi.fn() }))
vi.mock('#/services/vaultService', () => ({
  ephKeyService: { getUnlockRemainingMs: vi.fn() },
}))

import { useVaultAutoLock } from '#/hooks/useVaultAutoLock'
import { ephKeyService } from '#/services/vaultService'
import { useDeviceStore } from '#/stores/deviceStore'

const lock = vi.fn(async () => {})

type StoreSlice = { isLocked: boolean; lock: () => Promise<void> }

const setStore = (isLocked: boolean) =>
  vi
    .mocked(useDeviceStore)
    .mockImplementation((selector) =>
      (selector as (s: StoreSlice) => unknown)({ isLocked, lock }),
    )

describe('useVaultAutoLock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    lock.mockClear()
    vi.mocked(ephKeyService.getUnlockRemainingMs).mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('locks when the unlock window elapses', async () => {
    vi.mocked(ephKeyService.getUnlockRemainingMs)
      .mockResolvedValueOnce(5000)
      .mockResolvedValue(0)
    setStore(false)

    renderHook(() => useVaultAutoLock())
    await vi.advanceTimersByTimeAsync(5000)

    expect(lock).toHaveBeenCalledTimes(1)
  })

  it('does not lock before the window elapses', async () => {
    vi.mocked(ephKeyService.getUnlockRemainingMs).mockResolvedValue(5000)
    setStore(false)

    renderHook(() => useVaultAutoLock())
    await vi.advanceTimersByTimeAsync(4000)

    expect(lock).not.toHaveBeenCalled()
  })

  it('does nothing when the vault is already locked', async () => {
    setStore(true)

    renderHook(() => useVaultAutoLock())
    await vi.advanceTimersByTimeAsync(60_000)

    expect(ephKeyService.getUnlockRemainingMs).not.toHaveBeenCalled()
    expect(lock).not.toHaveBeenCalled()
  })

  it('does not lock after unmount', async () => {
    vi.mocked(ephKeyService.getUnlockRemainingMs)
      .mockResolvedValueOnce(5000)
      .mockResolvedValue(0)
    setStore(false)

    const { unmount } = renderHook(() => useVaultAutoLock())
    await vi.advanceTimersByTimeAsync(1000)
    unmount()
    await vi.advanceTimersByTimeAsync(10_000)

    expect(lock).not.toHaveBeenCalled()
  })
})
