import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('#/utils/environment', () => ({
  isBrowser: () => true,
  isExtension: () => true,
  isWeb: () => false,
}))

vi.mock('#/services/vaultService', () => ({
  ephKeyService: {
    getUnlockRemainingMs: vi.fn(),
  },
  zkProofService: {},
}))

import * as vaultService from '#/services/vaultService'
import { refreshExtensionLockState } from '#/stores/deviceStore/rehydrationHelpers'

describe('refreshExtensionLockState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('sets isLocked to false when the keeper reports remaining unlock time', async () => {
    vi.mocked(
      vaultService.ephKeyService.getUnlockRemainingMs,
    ).mockResolvedValue(60_000)
    const setState = vi.fn()

    await refreshExtensionLockState(setState)

    expect(setState).toHaveBeenCalledWith({ isLocked: false })
  })

  it('sets isLocked to true when the keeper reports no remaining unlock time', async () => {
    vi.mocked(
      vaultService.ephKeyService.getUnlockRemainingMs,
    ).mockResolvedValue(0)
    const setState = vi.fn()

    await refreshExtensionLockState(setState)

    expect(setState).toHaveBeenCalledWith({ isLocked: true })
  })
})
