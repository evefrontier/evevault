import { describe, expect, it } from 'vitest'
import {
  ARGON2_HASH_LENGTH,
  ARGON2_ITERATIONS,
  ARGON2_MEMORY_KIB,
  ARGON2_PARALLELISM,
  ARGON2_PARAMS,
  KDF_SALT_LENGTH,
} from './constants'

/**
 * These constants are the entire offline-brute-force defense for a low-entropy
 * PIN. A well-meaning "optimization" that lowers them silently weakens every
 * encrypted vault, so pin the floor here — bumping cost is fine, but lowering
 * it must be a deliberate, reviewed change to this test.
 */
describe('Argon2id KDF parameters', () => {
  it('meets the minimum cost floor', () => {
    expect(ARGON2_MEMORY_KIB).toBeGreaterThanOrEqual(65_536) // >= 64 MiB
    expect(ARGON2_ITERATIONS).toBeGreaterThanOrEqual(3)
    expect(ARGON2_HASH_LENGTH).toBe(32) // 256-bit AES key
    expect(KDF_SALT_LENGTH).toBeGreaterThanOrEqual(16)
  })

  it('exposes a single shared param object matching the individual constants', () => {
    expect(ARGON2_PARAMS).toEqual({
      iterations: ARGON2_ITERATIONS,
      parallelism: ARGON2_PARALLELISM,
      memorySize: ARGON2_MEMORY_KIB,
      hashLength: ARGON2_HASH_LENGTH,
    })
  })
})
