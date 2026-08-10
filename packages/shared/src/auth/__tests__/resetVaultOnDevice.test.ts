import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as authConfig from '#/auth/authConfig'
import * as getZkLoginAddress from '#/auth/getZkLoginAddress'
import { resetVaultOnDevice } from '#/auth/resetVaultOnDevice'
import * as storageService from '#/auth/storageService'
import { useAuthStore } from '#/auth/stores/authStore'
import * as vaultService from '#/services/vaultService'
import { useContextStore } from '#/stores/contextStore'
import { useDeviceStore } from '#/stores/deviceStore'
import { useTokenListStore } from '#/stores/tokenListStore'
import * as authCleanup from '#/utils/authCleanup'
import * as env from '#/utils/environment'

vi.mock('#/services/vaultService', () => ({
  ephKeyService: { clear: vi.fn() },
  zkProofService: { clear: vi.fn() },
}))

vi.mock('#/utils/environment', () => ({
  isExtension: vi.fn(),
  isWeb: vi.fn(),
}))

vi.mock('#/utils/authCleanup', () => ({
  cleanupOidcStorage: vi.fn(),
  cleanupExtensionStorage: vi.fn(),
}))

vi.mock('#/auth/authConfig', () => ({
  getUserManager: vi.fn(() => ({
    removeUser: vi.fn(),
  })),
}))

vi.mock('#/auth/getZkLoginAddress', () => ({
  clearZkLoginAddressCache: vi.fn(),
}))

vi.mock('#/auth/storageService', () => ({
  clearAllJwts: vi.fn(),
}))

vi.mock('#/stores/tenantStore', () => ({
  getCurrentTenantId: vi.fn(() => 'stillness'),
  getTenantIdForAuth: vi.fn(() => 'stillness'),
}))

vi.mock('#/stores/deviceStore', () => ({
  createEmptyNetworkDataEntry: () => ({
    nonce: null,
    maxEpoch: null,
    maxEpochTimestampMs: null,
    jwtRandomness: null,
  }),
  createEmptyLocalnetDeviceData: () => ({
    encryptedKey: null,
    address: null,
  }),
  useDeviceStore: {
    getState: vi.fn(),
    setState: vi.fn(),
  },
}))

vi.mock('#/stores/contextStore', () => ({
  useContextStore: {
    setState: vi.fn(),
  },
}))

vi.mock('#/stores/tokenListStore', () => ({
  useTokenListStore: {
    setState: vi.fn(),
  },
}))

vi.mock('#/auth/stores/authStore', () => ({
  useAuthStore: {
    setState: vi.fn(),
  },
}))

vi.mock('#/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

describe('resetVaultOnDevice', () => {
  let mockRemoveUser: ReturnType<typeof vi.fn>
  let mockDeviceLock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockRemoveUser = vi.fn().mockResolvedValue(undefined)
    vi.mocked(authConfig.getUserManager).mockReturnValue({
      removeUser: mockRemoveUser,
    } as unknown as ReturnType<typeof authConfig.getUserManager>)

    mockDeviceLock = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useDeviceStore.getState).mockReturnValue({
      lock: mockDeviceLock,
    } as unknown as ReturnType<typeof useDeviceStore.getState>)

    vi.mocked(vaultService.zkProofService.clear).mockResolvedValue(undefined)
    vi.mocked(vaultService.ephKeyService.clear).mockResolvedValue(undefined)
    vi.mocked(storageService.clearAllJwts).mockResolvedValue(undefined)
    vi.mocked(authCleanup.cleanupOidcStorage).mockImplementation(() => {})
    vi.mocked(authCleanup.cleanupExtensionStorage).mockResolvedValue(undefined)
    vi.mocked(getZkLoginAddress.clearZkLoginAddressCache).mockImplementation(
      () => {},
    )
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('calls zkProofService.clear() and ephKeyService.clear()', async () => {
    vi.mocked(env.isWeb).mockReturnValue(true)
    vi.mocked(env.isExtension).mockReturnValue(false)

    await resetVaultOnDevice()

    expect(vaultService.zkProofService.clear).toHaveBeenCalledOnce()
    expect(vaultService.ephKeyService.clear).toHaveBeenCalledOnce()
  })

  it('calls deviceStore.lock() only when isExtension()', async () => {
    vi.mocked(env.isWeb).mockReturnValue(false)
    vi.mocked(env.isExtension).mockReturnValue(true)

    await resetVaultOnDevice()

    expect(mockDeviceLock).toHaveBeenCalledOnce()
  })

  it('does not call deviceStore.lock() when isWeb()', async () => {
    vi.mocked(env.isWeb).mockReturnValue(true)
    vi.mocked(env.isExtension).mockReturnValue(false)

    await resetVaultOnDevice()

    expect(mockDeviceLock).not.toHaveBeenCalled()
  })

  it('calls clearAllJwts() and userManager.removeUser()', async () => {
    vi.mocked(env.isWeb).mockReturnValue(true)
    vi.mocked(env.isExtension).mockReturnValue(false)

    await resetVaultOnDevice()

    expect(storageService.clearAllJwts).toHaveBeenCalledOnce()
    expect(authConfig.getUserManager).toHaveBeenCalledWith('stillness')
    expect(mockRemoveUser).toHaveBeenCalledOnce()
  })

  it('calls deviceStore.setState and clears in-memory stores', async () => {
    vi.mocked(env.isWeb).mockReturnValue(true)
    vi.mocked(env.isExtension).mockReturnValue(false)

    await resetVaultOnDevice()

    expect(useDeviceStore.setState).toHaveBeenCalledWith(
      expect.objectContaining({
        isLocked: true,
        ephemeralPublicKey: null,
        loading: false,
        error: null,
      }),
    )
    expect(useAuthStore.setState).toHaveBeenCalledWith({
      user: null,
      loading: false,
      error: null,
    })
    expect(useContextStore.setState).toHaveBeenCalledWith(
      expect.objectContaining({
        chain: expect.any(String),
        loading: false,
      }),
    )
    expect(useTokenListStore.setState).toHaveBeenCalled()
  })

  it('calls clearZkLoginAddressCache()', async () => {
    vi.mocked(env.isWeb).mockReturnValue(true)
    vi.mocked(env.isExtension).mockReturnValue(false)

    await resetVaultOnDevice()

    expect(getZkLoginAddress.clearZkLoginAddressCache).toHaveBeenCalledOnce()
  })

  it('calls cleanupOidcStorage when isWeb()', async () => {
    vi.mocked(env.isWeb).mockReturnValue(true)
    vi.mocked(env.isExtension).mockReturnValue(false)

    const removeItem = vi.fn()
    const sessionRemoveItem = vi.fn()
    Object.defineProperty(global, 'window', {
      value: {
        localStorage: { removeItem },
        sessionStorage: { removeItem: sessionRemoveItem },
      },
      writable: true,
    })

    await resetVaultOnDevice()

    expect(authCleanup.cleanupOidcStorage).toHaveBeenCalledOnce()
  })

  it('calls cleanupExtensionStorage when isExtension()', async () => {
    vi.mocked(env.isWeb).mockReturnValue(false)
    vi.mocked(env.isExtension).mockReturnValue(true)
    const remove = vi.fn().mockResolvedValue(undefined)
    ;(
      global as unknown as {
        browser: { storage: { local: { remove: typeof remove } } }
      }
    ).browser = {
      storage: { local: { remove } },
    }

    await resetVaultOnDevice()

    expect(authCleanup.cleanupExtensionStorage).toHaveBeenCalledOnce()
  })

  it('propagates error when clearAllJwts fails', async () => {
    vi.mocked(env.isWeb).mockReturnValue(true)
    vi.mocked(env.isExtension).mockReturnValue(false)
    vi.mocked(storageService.clearAllJwts).mockRejectedValueOnce(
      new Error('JWT clear failed'),
    )

    await expect(resetVaultOnDevice()).rejects.toThrow('JWT clear failed')
  })

  it('propagates error when userManager.removeUser fails', async () => {
    vi.mocked(env.isWeb).mockReturnValue(true)
    vi.mocked(env.isExtension).mockReturnValue(false)
    mockRemoveUser.mockRejectedValueOnce(new Error('Remove user failed'))

    await expect(resetVaultOnDevice()).rejects.toThrow('Remove user failed')
  })
})
