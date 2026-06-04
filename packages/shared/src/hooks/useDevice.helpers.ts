import type { PublicKey } from '@mysten/sui/cryptography'
import { Ed25519PublicKey } from '@mysten/sui/keypairs/ed25519'
import { Secp256r1PublicKey } from '@mysten/sui/keypairs/secp256r1'
import type { SuiChain } from '@mysten/wallet-standard'
import type { DeviceState, NetworkDataMap, StoredSecretKey } from '#/types'
import { isLocalnetChain, isZkLoginSuiChain } from '#/types/networks'
import { KEY_FLAG_SECP256R1 } from '#/types/stores'
import { createLogger } from '#/utils/logger'

const log = createLogger()

type LocalnetData = DeviceState['localnet']

/** A configured PIN produces an encrypted key object with `{ iv, data }`; a raw/null key means no PIN was set. */
export const isPinConfigured = (secretKey: StoredSecretKey): boolean => {
  return Boolean(
    secretKey &&
      typeof secretKey === 'object' &&
      'iv' in secretKey &&
      'data' in secretKey,
  )
}

/** Localnet epoch data lives in its own slice; zkLogin chains store per-chain data in `networkData`. */
export const getCurrentDeviceData = ({
  currentChain,
  networkData,
  localnet,
}: {
  currentChain: SuiChain
  networkData: NetworkDataMap
  localnet: LocalnetData
}) => {
  if (isLocalnetChain(currentChain)) {
    return {
      maxEpoch: localnet.maxEpoch,
      maxEpochTimestampMs: localnet.maxEpochTimestampMs,
      nonce: null,
    }
  }

  const chainData = isZkLoginSuiChain(currentChain)
    ? networkData[currentChain]
    : undefined

  return {
    maxEpoch: chainData?.maxEpoch ?? null,
    maxEpochTimestampMs: chainData?.maxEpochTimestampMs ?? null,
    nonce: chainData?.nonce ?? null,
  }
}

/** The key flag determines which curve was used; without it we default to Ed25519. */
export const reconstructEphemeralPublicKey = (
  ephemeralPublicKeyBytes: number[] | null,
  ephemeralPublicKeyFlag: number | null,
): PublicKey | null => {
  if (!ephemeralPublicKeyBytes) {
    return null
  }

  try {
    return createPublicKey(
      new Uint8Array(ephemeralPublicKeyBytes),
      ephemeralPublicKeyFlag,
    )
  } catch (error) {
    log.error('Failed to reconstruct public key:', error)
    return null
  }
}

/** Curries the current chain into store actions so hook callers don't have to pass it at every call site. */
export const bindDeviceActions = (
  currentChain: SuiChain,
  { initialize, getZkProof }: Pick<DeviceState, 'initialize' | 'getZkProof'>,
) => ({
  initialize: (pin: string) => initialize(pin, currentChain),
  getZkProof: () => getZkProof(currentChain),
})

const createPublicKey = (
  keyBytes: Uint8Array,
  ephemeralPublicKeyFlag: number | null,
): PublicKey => {
  return ephemeralPublicKeyFlag === KEY_FLAG_SECP256R1
    ? new Secp256r1PublicKey(keyBytes)
    : new Ed25519PublicKey(keyBytes)
}
