import type { PublicKey } from "@mysten/sui/cryptography";
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { SuiChain } from "@mysten/wallet-standard";
import type { ZkProofResponse } from "./enoki";

// Key type flag bytes (matches Sui signature scheme flags)
export const KEY_FLAG_ED25519 = 0x00;
export const KEY_FLAG_SECP256R1 = 0x02;

export interface StorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

export type HashedData = { iv: string; data: string };

export type StoredSecretKey = HashedData | null;

export interface NetworkDataEntry {
  nonce: string | null;
  maxEpoch: string | null;
  maxEpochTimestampMs: number | null;
  jwtRandomness: string | null;
}

export type NetworkDataMap = Partial<Record<SuiChain, NetworkDataEntry>>;

// Device store state shape
export interface DeviceState {
  isLocked: boolean;
  ephemeralPublicKey: PublicKey | null;
  ephemeralPublicKeyBytes: number[] | null; // For persistence
  ephemeralPublicKeyFlag: number | null; // To identify key type (0x00=Ed25519, 0x02=Secp256r1)
  ephemeralKeyPairSecretKey: StoredSecretKey;
  // Network-specific data stored by chain (jwtRandomness is per-network)
  networkData: Partial<Record<SuiChain, NetworkDataEntry>>;

  loading: boolean;
  error: string | null;

  // Actions
  initialize: (pin: string) => Promise<void>;
  initializeForChain: (chain: SuiChain) => Promise<void>;
  getZkProof: () => Promise<ZkProofResponse | { error: string }>;
  lock: () => void;
  unlock: (pin: string) => void;
  reset: () => void;
  getMaxEpoch: (chain?: SuiChain) => string | null;
  getMaxEpochTimestampMs: (chain?: SuiChain) => number | null;
  getNonce: (chain?: SuiChain) => string | null;
  getJwtRandomness: (chain?: SuiChain) => string | null;
}

export interface SessionData {
  decryptedEphemeralKeyPairSecretKey: string | null;
}

export interface SessionState extends SessionData {
  setDecryptedEphemeralKeyPairSecretKey: (secretKey: string) => void;
  getEphemeralKeyPair: () => Ed25519Keypair | null;
  clear: () => void;
  loadFromStorage: () => void;
}

export interface NetworkSwitchResult {
  success: boolean;
  requiresReauth: boolean;
}

export interface NetworkState {
  chain: SuiChain;
  loading: boolean;
  initialize: () => Promise<void>;
  setChain: (chain: SuiChain) => Promise<NetworkSwitchResult>;
  /** Force set chain without JWT check - for logout-based network switching */
  forceSetChain: (chain: SuiChain) => void;
  /** Check if switching to a network requires re-authentication */
  checkNetworkSwitch: (chain: SuiChain) => Promise<{ requiresReauth: boolean }>;
}

export type PersistedDeviceStoreState = {
  jwtRandomness?: string | null;
  ephemeralKeyPairSecretKey?: StoredSecretKey | string | null;
  ephemeralPublicKeyBytes?: number[] | null;
  ephemeralPublicKeyFlag?: number | null;
  networkData?: NetworkDataMap;
};

export type PersistedDeviceStore = {
  state?: PersistedDeviceStoreState;
};

export interface TokenListState {
  tokens: string[];
  addToken: (coinType: string) => void;
  removeToken: (coinType: string) => void;
  clearTokens: () => void;
}
