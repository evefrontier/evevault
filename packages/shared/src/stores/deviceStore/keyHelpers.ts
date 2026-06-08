import { ZKSecp256r1Keypair } from '@evefrontier/wallet-core/crypto'
import type { PublicKey } from '@mysten/sui/cryptography'
import { Ed25519PublicKey } from '@mysten/sui/keypairs/ed25519'
import { Secp256r1PublicKey } from '@mysten/sui/keypairs/secp256r1'
import {
  type HashedData,
  KEY_FLAG_ED25519,
  KEY_FLAG_SECP256R1,
  type StoredSecretKey,
} from '#/types'
import { encrypt } from '#/utils'
import { isWeb } from '#/utils/environment'
import { createLogger } from '#/utils/logger'

const log = createLogger()

export const isHashedSecretKey = (value: unknown): value is HashedData => {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('iv' in value) ||
    !('data' in value)
  ) {
    return false
  }

  const candidate = value as { iv?: unknown; data?: unknown }
  return typeof candidate.iv === 'string' && typeof candidate.data === 'string'
}

export const resolveStoredSecretKey = async (
  value: unknown,
  pin: string,
): Promise<StoredSecretKey> => {
  if (!value) {
    return null
  }

  if (isHashedSecretKey(value)) {
    return value
  }

  if (typeof value === 'string') {
    return encrypt(value, pin)
  }

  return null
}

/** Reconstructs a PublicKey from stored bytes and flag. */
export const reconstructPublicKey = (
  bytes: number[],
  flag: number | null,
): PublicKey | null => {
  try {
    const keyBytes = new Uint8Array(bytes)
    const keyFlag = flag ?? (isWeb() ? KEY_FLAG_SECP256R1 : KEY_FLAG_ED25519)

    if (keyFlag === KEY_FLAG_SECP256R1) {
      return new Secp256r1PublicKey(keyBytes)
    }
    return new Ed25519PublicKey(keyBytes)
  } catch (error) {
    log.error('Error reconstructing public key', error)
    return null
  }
}
