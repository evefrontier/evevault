import type { PublicKey } from '@mysten/sui/cryptography'
import type { SuiChain } from '@mysten/wallet-standard'
import type { DeviceState, NetworkDataEntry, StoredSecretKey } from '#/types'
import { isLocalnetChain, isZkLoginSuiChain } from '#/types/networks'
import { isNonNullable } from '#/utils'
import type { SetDeviceState } from './types'

type ChainDeviceData = Pick<
  NetworkDataEntry,
  'maxEpoch' | 'maxEpochTimestampMs' | 'nonce'
>

const createEmptyNetworkData = (): NetworkDataEntry => ({
  maxEpoch: null,
  nonce: null,
  maxEpochTimestampMs: null,
  jwtRandomness: null,
})

export const isBlankPin = (pin: string): boolean => pin.trim().length === 0

export const getNetworkDataEntry = (
  state: DeviceState,
  chain: SuiChain,
): NetworkDataEntry => {
  return isZkLoginSuiChain(chain)
    ? (state.networkData[chain] ?? createEmptyNetworkData())
    : createEmptyNetworkData()
}

export const isDeviceDataExpired = (
  data?: Pick<NetworkDataEntry, 'maxEpochTimestampMs'>,
): boolean =>
  data?.maxEpochTimestampMs != null && Date.now() >= data.maxEpochTimestampMs

const requiredDeviceDataValues = (
  data: NetworkDataEntry,
  storedSecretKey: StoredSecretKey,
) => [
  data.jwtRandomness,
  data.maxEpoch,
  data.nonce,
  data.maxEpochTimestampMs,
  storedSecretKey,
]

/** `storedSecretKey` is part of "freshness" — without it the vault can't be unlocked even if epoch data is present. */
export const hasFreshNetworkData = (
  data: NetworkDataEntry,
  storedSecretKey: StoredSecretKey,
): boolean =>
  requiredDeviceDataValues(data, storedSecretKey).every(isNonNullable) &&
  !isDeviceDataExpired(data)

export const hasChainDeviceData = (data?: ChainDeviceData): boolean => {
  return Boolean(
    isNonNullable(data?.nonce) &&
      isNonNullable(data?.maxEpoch) &&
      !isDeviceDataExpired(data),
  )
}

/** Localnet uses `'localnet'` as a sentinel nonce — it never goes through zkLogin proof generation. */
export const getCurrentChainDeviceData = (
  state: DeviceState,
  chain: SuiChain,
): ChainDeviceData | undefined => {
  if (isLocalnetChain(chain)) {
    return {
      maxEpoch: state.localnet.maxEpoch,
      maxEpochTimestampMs: state.localnet.maxEpochTimestampMs,
      nonce: 'localnet',
    }
  }

  return isZkLoginSuiChain(chain) ? state.networkData[chain] : undefined
}

/** Omitting `secretKey` leaves the stored key unchanged — used when only refreshing the public key after an unlock. */
export const setPublicKeyState = (
  set: SetDeviceState,
  publicKey: PublicKey,
  secretKey?: StoredSecretKey,
) => {
  set({
    ephemeralPublicKey: publicKey,
    ephemeralPublicKeyBytes: Array.from(publicKey.toRawBytes()),
    ephemeralPublicKeyFlag: publicKey.flag(),
    ...(secretKey === undefined
      ? {}
      : { ephemeralKeyPairSecretKey: secretKey }),
  })
}
