import {
  SUI_DEVNET_CHAIN,
  SUI_MAINNET_CHAIN,
  SUI_TESTNET_CHAIN,
} from '@mysten/wallet-standard'
import type {
  LocalnetDeviceData,
  NetworkDataEntry,
  NetworkDataMap,
} from '#/types'
import { DEFAULT_LOCALNET_URL } from '#/utils/constants'

/** Empty network data entry; used for initial state and reset. */
export const createEmptyNetworkDataEntry = (): NetworkDataEntry => ({
  nonce: null,
  maxEpoch: null,
  maxEpochTimestampMs: null,
  jwtRandomness: null,
})

export const createInitialNetworkData = (): NetworkDataMap => ({
  [SUI_DEVNET_CHAIN]: createEmptyNetworkDataEntry(),
  [SUI_TESTNET_CHAIN]: createEmptyNetworkDataEntry(),
  [SUI_MAINNET_CHAIN]: createEmptyNetworkDataEntry(),
})

export const createEmptyLocalnetDeviceData = (): LocalnetDeviceData => ({
  encryptedKey: null,
  address: null,
  url: DEFAULT_LOCALNET_URL,
  maxEpoch: null,
  maxEpochTimestampMs: null,
})
