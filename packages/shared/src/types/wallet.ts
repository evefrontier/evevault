import type { PublicKey, Signer } from "@mysten/sui/cryptography";
import type {
  Ed25519Keypair,
  Ed25519PublicKey,
} from "@mysten/sui/keypairs/ed25519";
import type { getZkLoginSignature } from "@mysten/sui/zklogin";
import type { User } from "oidc-client-ts";
import type { ZkProofResponse } from "./enoki";
import type { StoredSecretKey } from "./stores";

// Web crypto placeholder constants - used when the actual key is stored in IndexedDB
// and managed by WebCryptoSigner (non-extractable)
export const WEB_CRYPTO_PLACEHOLDER_IV = "web-crypto-signer";
export const WEB_CRYPTO_PLACEHOLDER_DATA = "non-extractable-key";

export const createWebCryptoPlaceholder = (): StoredSecretKey => ({
  iv: WEB_CRYPTO_PLACEHOLDER_IV,
  data: WEB_CRYPTO_PLACEHOLDER_DATA,
});

export type PartialZkLoginSignature = Omit<
  Parameters<typeof getZkLoginSignature>[0]["inputs"],
  "addressSeed"
>;

export interface ZkSignAnyParams {
  user: User;
  ephemeralPublicKey: PublicKey;
  maxEpoch: string;
  getZkProof: () => Promise<ZkProofResponse | { error: string }>;
}

export interface ZkProofParams {
  jwtRandomness: string;
  maxEpoch: string;
  ephemeralPublicKey: PublicKey;
  idToken: string;
  enokiApiKey: string;
  network?: string; // Optional network parameter (devnet, testnet, mainnet)
}

export interface EphSignParams {
  sui_address: string;
  ephemeralKeyPair: Signer;
}

// Legacy types for extension (Ed25519-specific)
export interface ExtensionZkProofParams {
  jwtRandomness: string;
  maxEpoch: string;
  ephemeralKeyPair: Ed25519Keypair;
  idToken: string;
  enokiApiKey: string;
  network?: string;
}

export interface ExtensionEphSignParams {
  sui_address: string;
  ephemeralKeyPair: Ed25519Keypair;
}

// Type guard for Ed25519PublicKey
export const isEd25519PublicKey = (key: PublicKey): key is Ed25519PublicKey => {
  return key.flag() === 0x00; // Ed25519 flag byte
};

export interface UseBalanceParams {
  user: User | null;
  chain: import("@mysten/wallet-standard").SuiChain | null;
  coinType?: string;
}

export interface BalanceMetadata {
  decimals: number;
  symbol: string;
  name: string;
  description?: string | null;
  iconUrl?: string | null;
}

export interface CoinBalanceResult {
  rawBalance: string;
  formattedBalance: string;
  metadata: BalanceMetadata | null;
  coinType: string;
}
