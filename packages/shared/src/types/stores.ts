import type { ZKEd25519Keypair } from '@evefrontier/wallet-core/crypto'
import type { PublicKey } from '@mysten/sui/cryptography'
import type { SuiChain } from '@mysten/wallet-standard'
import type { ZkProofResponse } from './enoki'
import type { ZkLoginSuiChain } from './networks'
import type { TenantState } from './tenant'

// Key type flag bytes (matches Sui signature scheme flags)
export const KEY_FLAG_ED25519 = 0x00
export const KEY_FLAG_SECP256R1 = 0x02

export interface StorageAdapter {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<void>
  removeItem: (key: string) => Promise<void>
}

export type HashedData = { iv: string; data: string; salt: string }

export type StoredSecretKey = HashedData | null

export interface LocalnetDeviceData {
  encryptedKey: string | null
  address: string | null
  url: string
  maxEpoch: string | null
  maxEpochTimestampMs: number | null
}

export interface NetworkDataEntry {
  nonce: string | null
  maxEpoch: string | null
  maxEpochTimestampMs: number | null
  jwtRandomness: string | null
}

export type NetworkDataMap = Partial<Record<ZkLoginSuiChain, NetworkDataEntry>>

// Device store state shape
export interface DeviceState {
  isLocked: boolean
  ephemeralPublicKey: PublicKey | null
  ephemeralPublicKeyBytes: number[] | null // For persistence
  ephemeralPublicKeyFlag: number | null // To identify key type (0x00=Ed25519, 0x02=Secp256r1)
  ephemeralKeyPairSecretKey: StoredSecretKey
  // Network-specific data stored by chain (jwtRandomness is per-network)
  networkData: NetworkDataMap
  /** Extension-only localnet key material, encrypted with the same PIN-derived key as the device vault. */
  localnet: LocalnetDeviceData

  loading: boolean
  error: string | null

  // Actions
  initialize: (pin: string, chain: SuiChain) => Promise<void>
  initializeForChain: (chain: SuiChain) => Promise<void>
  rotateEphemeralKey: (chain: SuiChain) => Promise<void>
  getZkProof: (chain: SuiChain) => Promise<ZkProofResponse | { error: string }>
  lock: () => void
  unlock: (pin: string) => Promise<void>
  reset: () => void
  getMaxEpoch: (chain: SuiChain) => string | null
  getMaxEpochTimestampMs: (chain: SuiChain) => number | null
  getNonce: (chain: SuiChain) => string | null
  getJwtRandomness: (chain: SuiChain) => string | null
  setLocalnetUrl: (url: string) => void
}

export interface SessionData {
  decryptedEphemeralKeyPairSecretKey: string | null
}

export interface SessionState extends SessionData {
  setDecryptedEphemeralKeyPairSecretKey: (secretKey: string) => void
  getEphemeralKeyPair: () => ZKEd25519Keypair | null
  clear: () => void
  loadFromStorage: () => void
}

export interface NetworkSwitchResult {
  success: boolean
  requiresReauth: boolean
}

export interface NetworkState {
  chain: SuiChain
  loading: boolean
  setChain: (chain: SuiChain) => Promise<NetworkSwitchResult>
  /** Force set chain without JWT check - for logout-based network switching */
  forceSetChain: (chain: SuiChain) => void
  /** Check if switching to a network requires re-authentication */
  checkNetworkSwitch: (chain: SuiChain) => Promise<{ requiresReauth: boolean }>
}

export type ContextState = NetworkState & TenantState

export type PersistedDeviceStoreState = {
  jwtRandomness?: string | null
  ephemeralKeyPairSecretKey?: StoredSecretKey | string | null
  ephemeralPublicKeyBytes?: number[] | null
  ephemeralPublicKeyFlag?: number | null
  networkData?: NetworkDataMap
  localnet?: Partial<LocalnetDeviceData> | null
}

export type PersistedDeviceStore = {
  state?: PersistedDeviceStoreState
}

export interface TokenListState {
  tokens: Partial<Record<SuiChain, string[]>>
  addToken: (chain: SuiChain, coinType: string) => void
  removeToken: (chain: SuiChain, coinType: string) => void
  clearTokens: (chain?: SuiChain) => void
}
