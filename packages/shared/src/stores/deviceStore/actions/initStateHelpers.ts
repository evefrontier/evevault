import type { PublicKey } from '@mysten/sui/cryptography'
import type { SuiChain } from '@mysten/wallet-standard'
import type { DeviceState, NetworkDataEntry, StoredSecretKey } from '#/types'
import { isLocalnetChain, isZkLoginSuiChain } from '#/types/networks'
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

export const hasFreshNetworkData = (
  data: NetworkDataEntry,
  storedSecretKey: StoredSecretKey,
): boolean =>
  requiredDeviceDataValues(data, storedSecretKey).every(isPresent) &&
  !isDeviceDataExpired(data)

export const needsPersistedRehydration = (
  data: NetworkDataEntry,
  storedSecretKey: StoredSecretKey,
): boolean => !hasFreshNetworkData(data, storedSecretKey)

export const hasChainDeviceData = (data?: ChainDeviceData): boolean => {
  return Boolean(
    isPresent(data?.nonce) &&
      isPresent(data?.maxEpoch) &&
      !isDeviceDataExpired(data),
  )
}

const isPresent = <T>(value: T | null | undefined): value is T => {
  return value !== null && value !== undefined
}

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
