import type { ZKEd25519Keypair } from '@evefrontier/wallet-core/crypto'
import type { PublicKey, Signer } from '@mysten/sui/cryptography'
import type { Ed25519PublicKey } from '@mysten/sui/keypairs/ed25519'
import type { User } from 'oidc-client-ts'
import type { ZkProofResponse } from './enoki'
import type { WebCryptoKeyMarker } from './stores'

/**
 * Inert marker stored as the web vault's "secret key". The real key is a
 * non-extractable WebCrypto handle held in IndexedDB (managed by
 * WebCryptoSigner), so nothing sensitive is serialized — this marker only
 * signals that a vault exists.
 */
export const createWebCryptoPlaceholder = (): WebCryptoKeyMarker => ({
  webCryptoNonExtractable: true,
})

/** Type guard for the web vault's inert non-extractable-key marker. */
export const isWebCryptoMarker = (
  value: unknown,
): value is WebCryptoKeyMarker =>
  typeof value === 'object' &&
  value !== null &&
  (value as { webCryptoNonExtractable?: unknown }).webCryptoNonExtractable ===
    true

export interface ZkSignAnyParams {
  user: User
  getZkProof: () => Promise<ZkProofResponse | { error: string }>
}

export interface ZkProofParams {
  jwtRandomness: string
  maxEpoch: string
  ephemeralPublicKey: PublicKey
  idToken: string
  enokiApiKey: string
  network?: string // Optional network parameter (devnet, testnet, mainnet)
}

export interface RawSignParams {
  sui_address: string
  keypair: Signer
}

// Legacy types for extension (Ed25519-specific)
export interface ExtensionZkProofParams {
  jwtRandomness: string
  maxEpoch: string
  ephemeralKeyPair: ZKEd25519Keypair
  idToken: string
  enokiApiKey: string
  network?: string
}

export interface ExtensionEphSignParams {
  sui_address: string
  ephemeralKeyPair: ZKEd25519Keypair
}

// Type guard for Ed25519PublicKey
export const isEd25519PublicKey = (key: PublicKey): key is Ed25519PublicKey => {
  return key.flag() === 0x00 // Ed25519 flag byte
}
