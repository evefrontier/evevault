import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mutable so each describe block can pick the surface; the helper reads
// isWeb() at call time, not import time.
let webMode = false

vi.mock('#/utils/environment', () => ({
  isBrowser: () => true,
  isExtension: () => !webMode,
  isWeb: () => webMode,
}))

vi.mock('#/services/vaultService', () => ({
  ephKeyService: {
    getUnlockRemainingMs: vi.fn(),
    initialize: vi.fn(),
    isUnlocked: vi.fn(),
  },
  zkProofService: {},
}))

import * as vaultService from '#/services/vaultService'
import { refreshVaultLockState } from '#/stores/deviceStore/rehydrationHelpers'

describe('refreshVaultLockState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('extension', () => {
    beforeEach(() => {
      webMode = false
    })

    it('sets isLocked to false when the keeper reports remaining unlock time', async () => {
      vi.mocked(
        vaultService.ephKeyService.getUnlockRemainingMs,
      ).mockResolvedValue(60_000)
      const setState = vi.fn()

      await refreshVaultLockState(setState)

      expect(setState).toHaveBeenCalledWith({ isLocked: false })
    })

    it('sets isLocked to true when the keeper reports no remaining unlock time', async () => {
      vi.mocked(
        vaultService.ephKeyService.getUnlockRemainingMs,
      ).mockResolvedValue(0)
      const setState = vi.fn()

      await refreshVaultLockState(setState)

      expect(setState).toHaveBeenCalledWith({ isLocked: true })
    })
  })

  describe('web', () => {
    beforeEach(() => {
      webMode = true
    })

    it('initializes the vault service before reading the lock state', async () => {
      const calls: string[] = []
      vi.mocked(vaultService.ephKeyService.initialize).mockImplementation(
        async () => {
          calls.push('initialize')
        },
      )
      vi.mocked(vaultService.ephKeyService.isUnlocked).mockImplementation(
        () => {
          calls.push('isUnlocked')
          return true
        },
      )

      await refreshVaultLockState(vi.fn())

      expect(calls).toEqual(['initialize', 'isUnlocked'])
    })

    it('sets isLocked to false when the restored session is unlocked', async () => {
      vi.mocked(vaultService.ephKeyService.isUnlocked).mockReturnValue(true)
      const setState = vi.fn()

      await refreshVaultLockState(setState)

      expect(setState).toHaveBeenCalledWith({ isLocked: false })
    })

    it('sets isLocked to true when the vault stays locked after initialize', async () => {
      vi.mocked(vaultService.ephKeyService.isUnlocked).mockReturnValue(false)
      const setState = vi.fn()

      await refreshVaultLockState(setState)

      expect(setState).toHaveBeenCalledWith({ isLocked: true })
    })
  })
})
