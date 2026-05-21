import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as vaultService from '#/services/vaultService'
import { useDeviceStore } from '#/stores/deviceStore'

// Mock the vault service (unified service that routes to keeper/web)
vi.mock('#/services/vaultService', () => ({
  ephKeyService: {
    lock: vi.fn(),
    isUnlocked: vi.fn(),
  },
  zkProofService: {},
}))

describe('deviceStore.lock()', () => {
  beforeEach(() => {
    // Reset store state before each test
    useDeviceStore.setState({
      isLocked: false,
      ephemeralPublicKey: null,
      ephemeralPublicKeyBytes: null,
      ephemeralKeyPairSecretKey: null,
      networkData: {},
      localnet: {
        encryptedKey: null,
        address: null,
        url: 'http://127.0.0.1:9000',
        maxEpoch: null,
        maxEpochTimestampMs: null,
      },
      loading: false,
      error: null,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('calls ephKeyService.lock() and sets isLocked to true', async () => {
    const mockLock = vi.mocked(vaultService.ephKeyService.lock)
    mockLock.mockResolvedValueOnce(undefined)

    await useDeviceStore.getState().lock()

    expect(mockLock).toHaveBeenCalledOnce()
    expect(useDeviceStore.getState().isLocked).toBe(true)
  })

  it('sets isLocked to true even if already locked', async () => {
    useDeviceStore.setState({ isLocked: true })
    const mockLock = vi.mocked(vaultService.ephKeyService.lock)
    mockLock.mockResolvedValueOnce(undefined)

    await useDeviceStore.getState().lock()

    expect(mockLock).toHaveBeenCalledOnce()
    expect(useDeviceStore.getState().isLocked).toBe(true)
  })

  it('handles error when ephKeyService.lock() fails', async () => {
    const mockLock = vi.mocked(vaultService.ephKeyService.lock)
    const error = new Error('Keeper lock failed')
    mockLock.mockRejectedValueOnce(error)

    await expect(useDeviceStore.getState().lock()).rejects.toThrow(
      'Keeper lock failed',
    )

    expect(mockLock).toHaveBeenCalledOnce()
    // State should not change if lock fails
    expect(useDeviceStore.getState().isLocked).toBe(false)
  })
})
