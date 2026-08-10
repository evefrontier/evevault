import { SUI_LOCALNET_CHAIN, SUI_TESTNET_CHAIN } from '@mysten/wallet-standard'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  NetworkDataEntry,
  NetworkDataMap,
  PersistedDeviceStoreState,
  StoredSecretKey,
} from '#/types'
import { DEVICE_STORAGE_KEY } from '#/utils/storageKeys'

const { logger, mockResolveStoredSecretKey, mockUnlockVault } = vi.hoisted(
  () => ({
    logger: {
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    },
    mockResolveStoredSecretKey: vi.fn(),
    mockUnlockVault: vi.fn(),
  }),
)

vi.mock('#/stores/deviceStore/keyHelpers', () => ({
  resolveStoredSecretKey: mockResolveStoredSecretKey,
}))

vi.mock('#/services/vaultService', () => ({
  ephKeyService: {
    unlockVault: mockUnlockVault,
  },
}))

vi.mock('#/utils/logger', () => ({
  createLogger: () => logger,
}))

import {
  readPersistedDeviceStoreState,
  tryRehydrateExtensionDevice,
} from '#/stores/deviceStore/actions/initPersistenceHelpers'

const storedSecretKey: StoredSecretKey = {
  data: 'data',
  iv: 'iv',
  salt: 'salt',
}

const networkDataEntry: NetworkDataEntry = {
  jwtRandomness: 'current-randomness',
  maxEpoch: '10',
  maxEpochTimestampMs: Date.now() + 60_000,
  nonce: 'current-nonce',
}

const fallbackNetworkData: NetworkDataMap = {
  [SUI_TESTNET_CHAIN]: networkDataEntry,
}

function persistedState(
  overrides: Partial<PersistedDeviceStoreState> = {},
): PersistedDeviceStoreState {
  return {
    ephemeralKeyPairSecretKey: storedSecretKey,
    networkData: {
      [SUI_TESTNET_CHAIN]: {
        jwtRandomness: 'persisted-randomness',
        maxEpoch: '12',
        maxEpochTimestampMs: Date.now() + 60_000,
        nonce: 'persisted-nonce',
      },
    },
    ...overrides,
  } as PersistedDeviceStoreState
}

function stubBrowserStorage(value: unknown) {
  vi.stubGlobal('browser', {
    storage: {
      local: {
        get: vi.fn(async () => ({ [DEVICE_STORAGE_KEY]: value })),
      },
    },
  })
}

describe('initPersistenceHelpers', () => {
  beforeEach(() => {
    mockResolveStoredSecretKey.mockResolvedValue(storedSecretKey)
    mockUnlockVault.mockResolvedValue({
      flag: () => 0,
      toRawBytes: () => new Uint8Array(32).fill(1),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('reads persisted state from string storage', async () => {
    const state = persistedState()
    stubBrowserStorage(JSON.stringify({ state }))

    await expect(readPersistedDeviceStoreState()).resolves.toEqual(state)
  })

  it('reads persisted state from object storage', async () => {
    const state = persistedState()
    stubBrowserStorage({ state })

    await expect(readPersistedDeviceStoreState()).resolves.toEqual(state)
  })

  it('returns null when no persisted store exists', async () => {
    stubBrowserStorage(null)

    await expect(readPersistedDeviceStoreState()).resolves.toBeNull()
  })

  it('rehydrates extension state when persisted randomness and secret key exist', async () => {
    const state = persistedState()
    const set = vi.fn()
    stubBrowserStorage({ state })

    const result = await tryRehydrateExtensionDevice({
      pin: '123456',
      currentChain: SUI_TESTNET_CHAIN,
      currentNetworkData: networkDataEntry,
      storedSecretKey: null,
      fallbackNetworkData,
      set,
    })

    expect(mockResolveStoredSecretKey).toHaveBeenCalledWith(
      storedSecretKey,
      '123456',
    )
    expect(set).toHaveBeenCalledWith({
      ephemeralPublicKey: expect.any(Object),
      ephemeralPublicKeyBytes: Array.from(new Uint8Array(32).fill(1)),
      ephemeralPublicKeyFlag: 0,
      ephemeralKeyPairSecretKey: storedSecretKey,
    })
    expect(set).toHaveBeenCalledWith({
      networkData: state.networkData,
      loading: false,
      isLocked: false,
      error: null,
    })
    expect(result).toEqual({
      rehydrated: true,
      storedSecretKey,
      jwtRandomness: 'persisted-randomness',
    })
  })

  it('falls back to current randomness for non-zkLogin chains', async () => {
    const state = persistedState({ networkData: {} })
    const set = vi.fn()
    stubBrowserStorage({ state })

    const result = await tryRehydrateExtensionDevice({
      pin: '123456',
      currentChain: SUI_LOCALNET_CHAIN,
      currentNetworkData: networkDataEntry,
      storedSecretKey: null,
      fallbackNetworkData,
      set,
    })

    expect(result.jwtRandomness).toBe(networkDataEntry.jwtRandomness)
    expect(result.rehydrated).toBe(true)
  })

  it('does not rehydrate when randomness or secret key cannot be resolved', async () => {
    mockResolveStoredSecretKey.mockResolvedValue(null)
    stubBrowserStorage({ state: persistedState({ networkData: {} }) })
    const set = vi.fn()

    const result = await tryRehydrateExtensionDevice({
      pin: '123456',
      currentChain: SUI_TESTNET_CHAIN,
      currentNetworkData: { ...networkDataEntry, jwtRandomness: null },
      storedSecretKey,
      fallbackNetworkData,
      set,
    })

    expect(set).not.toHaveBeenCalled()
    expect(result).toEqual({
      rehydrated: false,
      storedSecretKey: null,
      jwtRandomness: null,
    })
  })

  it('returns the current state when persisted storage is absent or invalid', async () => {
    stubBrowserStorage('not-json')
    const set = vi.fn()

    const result = await tryRehydrateExtensionDevice({
      pin: '123456',
      currentChain: SUI_TESTNET_CHAIN,
      currentNetworkData: networkDataEntry,
      storedSecretKey,
      fallbackNetworkData,
      set,
    })

    expect(set).not.toHaveBeenCalled()
    expect(result).toEqual({
      rehydrated: false,
      storedSecretKey,
      jwtRandomness: networkDataEntry.jwtRandomness,
    })
    expect(logger.error).toHaveBeenCalledWith(
      'Error parsing persisted device store',
      expect.any(Error),
    )
  })

  it('logs secret key resolution failures separately from parse failures', async () => {
    mockResolveStoredSecretKey.mockRejectedValue(new Error('decrypt failed'))
    stubBrowserStorage({ state: persistedState() })
    const set = vi.fn()

    const result = await tryRehydrateExtensionDevice({
      pin: '123456',
      currentChain: SUI_TESTNET_CHAIN,
      currentNetworkData: networkDataEntry,
      storedSecretKey,
      fallbackNetworkData,
      set,
    })

    expect(set).not.toHaveBeenCalled()
    expect(result).toEqual({
      rehydrated: false,
      storedSecretKey,
      jwtRandomness: networkDataEntry.jwtRandomness,
    })
    expect(logger.error).toHaveBeenCalledWith(
      'Error resolving persisted device store state',
      expect.any(Error),
    )
  })
})
