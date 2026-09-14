import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('#/utils/environment', () => ({
  isBrowser: () => true,
  isExtension: () => false,
  isWeb: () => true,
}))

vi.mock('#/services/vaultService', () => ({
  ephKeyService: {
    initialize: vi.fn(async () => {}),
    isUnlocked: vi.fn(() => false),
    hasKeypair: vi.fn(),
    getUnlockRemainingMs: vi.fn(),
  },
  zkProofService: {},
}))

vi.mock('#/auth/resetVaultOnDevice', () => ({
  resetVaultOnDevice: vi.fn(async () => {}),
}))

import { resetVaultOnDevice } from '#/auth/resetVaultOnDevice'
import { ephKeyService } from '#/services/vaultService'
import { refreshVaultLockState } from '#/stores/deviceStore/rehydrationHelpers'
import type { DeviceState } from '#/types'
import { SESSION_EXPIRED_PARAM } from '#/utils/routes'

// Only the fields recoverFromLostWebKeypair reads matter here.
const configuredState = {
  ephemeralPublicKeyBytes: Array.from(new Uint8Array(33).fill(3)),
} as unknown as DeviceState

describe('refreshVaultLockState — lost web keypair recovery', () => {
  const originalLocation = window.location

  beforeEach(() => {
    vi.clearAllMocks()
    // clearAllMocks keeps overridden implementations, so restore the locked default.
    vi.mocked(ephKeyService.isUnlocked).mockReturnValue(false)
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: '' },
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    })
  })

  it('resets and redirects to the session-expired login when the configured keypair is gone', async () => {
    vi.mocked(ephKeyService.hasKeypair).mockResolvedValue(false)
    const setState = vi.fn()

    await refreshVaultLockState(setState, configuredState)

    expect(resetVaultOnDevice).toHaveBeenCalledOnce()
    expect(window.location.href).toBe(`/?${SESSION_EXPIRED_PARAM}=1`)
    // Recovery took over, so it skips its own lock-state write.
    expect(setState).not.toHaveBeenCalled()
  })

  it('does not reset when the keypair still exists', async () => {
    vi.mocked(ephKeyService.hasKeypair).mockResolvedValue(true)
    vi.mocked(ephKeyService.isUnlocked).mockReturnValue(true)
    const setState = vi.fn()

    await refreshVaultLockState(setState, configuredState)

    expect(resetVaultOnDevice).not.toHaveBeenCalled()
    expect(window.location.href).toBe('')
    expect(setState).toHaveBeenCalledWith({ isLocked: false })
  })

  it('does not check IndexedDB or reset when no configured keypair marker is present', async () => {
    const setState = vi.fn()

    await refreshVaultLockState(setState, {} as DeviceState)

    expect(ephKeyService.hasKeypair).not.toHaveBeenCalled()
    expect(resetVaultOnDevice).not.toHaveBeenCalled()
    expect(setState).toHaveBeenCalledWith({ isLocked: true })
  })

  it('stays locked without signing out when the keypair check throws (transient IndexedDB failure)', async () => {
    vi.mocked(ephKeyService.hasKeypair).mockRejectedValue(
      new Error('failed to open IndexedDB'),
    )
    const setState = vi.fn()

    await refreshVaultLockState(setState, configuredState)

    expect(resetVaultOnDevice).not.toHaveBeenCalled()
    expect(window.location.href).toBe('')
    expect(setState).toHaveBeenCalledWith({ isLocked: true })
  })
})
