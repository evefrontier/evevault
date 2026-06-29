import type { ZKEd25519Keypair } from '@evefrontier/wallet-core/crypto'
import { VAULT_UNLOCK_MS, type ZkProofResponse } from '@evevault/shared'
import type { SuiChain } from '@mysten/wallet-standard'
import type { LocalnetState } from './local'

/*
 * This module is loaded by the offscreen keeper document and is intentionally
 * stateful. The service worker can be suspended, but the offscreen document can
 * keep these values alive in memory without persisting decrypted secrets.
 */

// Decrypted zkLogin ephemeral key. This must never be written to extension storage.
let ephemeralKey: ZKEd25519Keypair | null = null

// Dev-only localnet signer. Kept separate so localnet can work without zkLogin proofs.
export const localnetState: LocalnetState = { localnetKey: null }

/*
 * Rotation re-encrypts a new ephemeral secret key without asking for the PIN
 * again. We cache only a non-extractable CryptoKey plus the original salt — the
 * PIN itself is never cached. Argon2id derivation briefly materialises the
 * derived key bytes in JS before importKey(); those bytes are zeroed right
 * after import (see deriveAesKey).
 */
let sessionDerivedKey: CryptoKey | null = null
let sessionSalt: string | null = null // base64 Argon2id salt from the stored HashedData

let _vaultUnlocked = false
let _vaultUnlockExpiry: number | null = null

// zkProofs are chain-specific and tied to the in-memory ephemeral key.
let zkProofs: Partial<Record<SuiChain, ZkProofResponse | null>> =
  emptyZkProofs()

function emptyZkProofs(): Partial<Record<SuiChain, ZkProofResponse | null>> {
  return {
    'sui:devnet': null,
    'sui:testnet': null,
    'sui:mainnet': null,
  }
}

export function lockVault(): void {
  // Clear every value that can authorize signing or future key rotation.
  ephemeralKey = null
  localnetState.localnetKey = null
  sessionDerivedKey = null
  sessionSalt = null
  _vaultUnlocked = false
  _vaultUnlockExpiry = null
}

export function unlockVaultWithKeypair(keypair: ZKEd25519Keypair): void {
  ephemeralKey = keypair
  _vaultUnlocked = true
  _vaultUnlockExpiry = Date.now() + VAULT_UNLOCK_MS
}

export function keeperReplaceEphemeralKey(keypair: ZKEd25519Keypair): void {
  // Preserve the original unlock expiry while swapping the rotated key.
  ephemeralKey = keypair
}

export function getEphemeralKey(): ZKEd25519Keypair | null {
  return ephemeralKey
}

export function setSessionKey(derivedKey: CryptoKey, salt: string): void {
  sessionDerivedKey = derivedKey
  sessionSalt = salt
}

export function getSessionKey(): {
  derivedKey: CryptoKey
  salt: string
} | null {
  if (!sessionDerivedKey || !sessionSalt) {
    return null
  }

  return { derivedKey: sessionDerivedKey, salt: sessionSalt }
}

export function enforceExpiry(): boolean {
  if (!ephemeralKey && !localnetState.localnetKey) {
    return true // Already locked
  }

  if (_vaultUnlockExpiry && Date.now() > _vaultUnlockExpiry) {
    lockVault()
    return true // Now locked
  }

  return false // Still unlocked
}

export function clearZkProofs(): void {
  zkProofs = emptyZkProofs()
}

export function getZkProof(chain: SuiChain): ZkProofResponse | null {
  return zkProofs[chain] ?? null
}

export function setZkProof(chain: SuiChain, zkProof: ZkProofResponse): void {
  zkProofs[chain] = zkProof
}
