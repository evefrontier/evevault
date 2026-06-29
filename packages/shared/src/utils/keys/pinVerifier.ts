import { argon2id, argon2Verify } from 'hash-wasm'
import { ARGON2_PARAMS, KDF_SALT_LENGTH } from './constants'

const cryptoApi =
  typeof crypto !== 'undefined' ? crypto : (window as Window).crypto

/**
 * Creates an Argon2id verifier for a PIN. The returned "encoded" string embeds
 * a random per-user salt and the Argon2id parameters, so it is fully
 * self-describing. This is a UX-level unlock gate — NOT key material — but
 * Argon2id's memory-hardness means a stolen verifier cannot be reversed to the
 * PIN by cheap offline brute-force.
 */
export async function createPinVerifier(pin: string): Promise<string> {
  const salt = cryptoApi.getRandomValues(new Uint8Array(KDF_SALT_LENGTH))
  return argon2id({
    password: pin,
    salt,
    ...ARGON2_PARAMS,
    outputType: 'encoded',
  })
}

/**
 * Verifies a PIN against a stored verifier created by createPinVerifier().
 * argon2Verify performs a constant-time comparison internally. Returns false
 * (rather than throwing) on malformed verifiers.
 */
export async function verifyPin(
  pin: string,
  verifier: string,
): Promise<boolean> {
  try {
    return await argon2Verify({ password: pin, hash: verifier })
  } catch {
    return false
  }
}
