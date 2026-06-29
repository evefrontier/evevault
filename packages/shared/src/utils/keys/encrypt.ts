import { argon2id } from 'hash-wasm'
import { bytesToB64 } from '../base64'
import {
  AES_IV_LENGTH,
  ARGON2_HASH_LENGTH,
  ARGON2_ITERATIONS,
  ARGON2_MEMORY_KIB,
  ARGON2_PARALLELISM,
  KDF_SALT_LENGTH,
} from './constants'

const cryptoApi =
  typeof crypto !== 'undefined' ? crypto : (window as Window).crypto

/**
 * Derives a non-extractable AES-GCM key from a PIN and salt using Argon2id.
 * Argon2id is memory-hard, so each guess is expensive even on GPUs — the key
 * defense for a low-entropy PIN. The returned CryptoKey is an opaque handle.
 */
export async function deriveAesKey(
  pin: string,
  salt: Uint8Array<ArrayBuffer>,
  usage: KeyUsage[],
): Promise<CryptoKey> {
  const rawKey = await argon2id({
    password: pin,
    salt,
    iterations: ARGON2_ITERATIONS,
    parallelism: ARGON2_PARALLELISM,
    memorySize: ARGON2_MEMORY_KIB,
    hashLength: ARGON2_HASH_LENGTH,
    outputType: 'binary',
  })
  // Copy into a fresh ArrayBuffer-backed view so the type is BufferSource
  // (hash-wasm returns Uint8Array<ArrayBufferLike>).
  return cryptoApi.subtle.importKey(
    'raw',
    new Uint8Array(rawKey),
    'AES-GCM',
    false,
    usage,
  )
}

export async function encrypt(string: string, pin: string) {
  // Generate a random salt for Argon2id key derivation
  const salt = cryptoApi.getRandomValues(new Uint8Array(KDF_SALT_LENGTH))
  const aesKey = await deriveAesKey(pin, salt, ['encrypt'])

  const iv = cryptoApi.getRandomValues(new Uint8Array(AES_IV_LENGTH))
  const encryptedData = await cryptoApi.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    new TextEncoder().encode(string),
  )

  return {
    iv: bytesToB64(iv),
    data: bytesToB64(new Uint8Array(encryptedData)),
    salt: bytesToB64(salt),
  }
}

/**
 * Encrypts using a pre-derived CryptoKey, skipping the Argon2id step.
 * The original salt is preserved in the output so that decrypt(result, pin)
 * can re-derive the same key on next unlock.
 */
export async function encryptWithKey(
  string: string,
  key: CryptoKey,
  salt: string,
) {
  const iv = cryptoApi.getRandomValues(new Uint8Array(AES_IV_LENGTH))
  const encryptedData = await cryptoApi.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(string),
  )

  return {
    iv: bytesToB64(iv),
    data: bytesToB64(new Uint8Array(encryptedData)),
    salt,
  }
}
