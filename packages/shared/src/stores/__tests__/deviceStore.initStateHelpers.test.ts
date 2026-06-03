import { Ed25519PublicKey } from '@mysten/sui/keypairs/ed25519'
import {
  SUI_LOCALNET_CHAIN,
  SUI_MAINNET_CHAIN,
  SUI_TESTNET_CHAIN,
} from '@mysten/wallet-standard'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getCurrentChainDeviceData,
  getNetworkDataEntry,
  hasChainDeviceData,
  hasFreshNetworkData,
  isBlankPin,
  isDeviceDataExpired,
  needsPersistedRehydration,
  setPublicKeyState,
} from '#/stores/deviceStore/actions/initStateHelpers'
import type { DeviceState, NetworkDataEntry, StoredSecretKey } from '#/types'

const futureTimestamp = () => Date.now() + 60_000
const pastTimestamp = () => Date.now() - 60_000

const completeNetworkData = (): NetworkDataEntry => ({
  jwtRandomness: 'randomness',
  maxEpoch: '12',
  maxEpochTimestampMs: futureTimestamp(),
  nonce: 'nonce',
})

const storedSecretKey: StoredSecretKey = {
  data: 'data',
  iv: 'iv',
  salt: 'salt',
}

function createState(networkData = completeNetworkData()): DeviceState {
  return {
    networkData: {
      [SUI_TESTNET_CHAIN]: networkData,
    },
    localnet: {
      maxEpoch: '7',
      maxEpochTimestampMs: futureTimestamp(),
    },
  } as DeviceState
}

describe('initStateHelpers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('detects blank PIN values', () => {
    expect(isBlankPin('')).toBe(true)
    expect(isBlankPin('   ')).toBe(true)
    expect(isBlankPin('123456')).toBe(false)
  })

  it('returns zkLogin network data for supported chains', () => {
    const entry = completeNetworkData()
    expect(getNetworkDataEntry(createState(entry), SUI_TESTNET_CHAIN)).toBe(
      entry,
    )
  })

  it('returns empty network data for unsupported or missing chain data', () => {
    const localnetEntry = getNetworkDataEntry(createState(), SUI_LOCALNET_CHAIN)
    const mainnetEntry = getNetworkDataEntry(createState(), SUI_MAINNET_CHAIN)

    expect(localnetEntry).toEqual({
      jwtRandomness: null,
      maxEpoch: null,
      maxEpochTimestampMs: null,
      nonce: null,
    })
    expect(mainnetEntry).toEqual({
      jwtRandomness: null,
      maxEpoch: null,
      maxEpochTimestampMs: null,
      nonce: null,
    })
    expect(localnetEntry).not.toBe(mainnetEntry)
  })

  it('detects expired device data', () => {
    expect(isDeviceDataExpired({ maxEpochTimestampMs: pastTimestamp() })).toBe(
      true,
    )
    expect(
      isDeviceDataExpired({ maxEpochTimestampMs: futureTimestamp() }),
    ).toBe(false)
    expect(isDeviceDataExpired(undefined)).toBe(false)
  })

  it('detects fresh and incomplete network data', () => {
    const fresh = completeNetworkData()
    const expired = {
      ...fresh,
      maxEpochTimestampMs: pastTimestamp(),
    }
    const missingNonce = {
      ...fresh,
      nonce: null,
    }
    const zeroEpoch = {
      ...fresh,
      maxEpoch: 0 as never,
    }

    expect(hasFreshNetworkData(fresh, storedSecretKey)).toBe(true)
    expect(hasFreshNetworkData(zeroEpoch, storedSecretKey)).toBe(true)
    expect(hasFreshNetworkData(expired, storedSecretKey)).toBe(false)
    expect(hasFreshNetworkData(missingNonce, storedSecretKey)).toBe(false)
    expect(hasFreshNetworkData(fresh, null)).toBe(false)

    expect(needsPersistedRehydration(fresh, storedSecretKey)).toBe(false)
    expect(needsPersistedRehydration(zeroEpoch, storedSecretKey)).toBe(false)
    expect(needsPersistedRehydration(missingNonce, storedSecretKey)).toBe(true)
    expect(needsPersistedRehydration(fresh, null)).toBe(true)
  })

  it('detects complete per-chain device data', () => {
    expect(hasChainDeviceData(completeNetworkData())).toBe(true)
    expect(
      hasChainDeviceData({
        maxEpoch: '12',
        maxEpochTimestampMs: pastTimestamp(),
        nonce: 'nonce',
      }),
    ).toBe(false)
    expect(hasChainDeviceData(undefined)).toBe(false)
  })

  it('returns current chain device data for localnet and zkLogin chains', () => {
    const state = createState()

    expect(getCurrentChainDeviceData(state, SUI_LOCALNET_CHAIN)).toEqual({
      maxEpoch: '7',
      maxEpochTimestampMs: state.localnet.maxEpochTimestampMs,
      nonce: 'localnet',
    })
    expect(getCurrentChainDeviceData(state, SUI_TESTNET_CHAIN)).toMatchObject({
      jwtRandomness: 'randomness',
      maxEpoch: '12',
      nonce: 'nonce',
    })
  })

  it('sets public key state with optional secret key', () => {
    const publicKey = new Ed25519PublicKey(new Uint8Array(32).fill(1))
    const set = vi.fn()

    setPublicKeyState(set, publicKey, storedSecretKey)
    expect(set).toHaveBeenCalledWith({
      ephemeralPublicKey: publicKey,
      ephemeralPublicKeyBytes: Array.from(publicKey.toRawBytes()),
      ephemeralPublicKeyFlag: publicKey.flag(),
      ephemeralKeyPairSecretKey: storedSecretKey,
    })

    setPublicKeyState(set, publicKey)
    expect(set).toHaveBeenLastCalledWith({
      ephemeralPublicKey: publicKey,
      ephemeralPublicKeyBytes: Array.from(publicKey.toRawBytes()),
      ephemeralPublicKeyFlag: publicKey.flag(),
    })
  })
})
