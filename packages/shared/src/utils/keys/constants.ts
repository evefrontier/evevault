/**
 * Cryptographic constants for key derivation and encryption.
 * Centralized to prevent parameter drift between encrypt() and decrypt().
 *
 * Key derivation uses Argon2id.
 */

// Argon2id parameters. memorySize dominates the cost-per-guess against GPUs.
export const ARGON2_MEMORY_KIB = 65_536 // 64 MiB
export const ARGON2_ITERATIONS = 3
export const ARGON2_PARALLELISM = 1
export const ARGON2_HASH_LENGTH = 32 // bytes -> 256-bit AES key

/**
 * The Argon2id cost/output parameters, as a single object so every call site
 * (deriveAesKey, createPinVerifier, ...) spreads the same values. Spread it and
 * add the per-call `password`, `salt`, and `outputType`. Changing the cost here
 * updates every consumer at once, which is the whole point of centralizing it.
 */
export const ARGON2_PARAMS = {
  iterations: ARGON2_ITERATIONS,
  parallelism: ARGON2_PARALLELISM,
  memorySize: ARGON2_MEMORY_KIB,
  hashLength: ARGON2_HASH_LENGTH,
} as const

export const KDF_SALT_LENGTH = 16 // bytes
export const AES_KEY_LENGTH = 256 // bits
export const AES_IV_LENGTH = 12 // bytes
