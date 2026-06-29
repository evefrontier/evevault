/**
 * Computes SHA-256 hash of a string, returning raw bytes.
 * Used for fixed-purpose digests such as the OAuth PKCE code challenge.
 * NOTE: do not use this to hash PINs/passwords — use Argon2id (see
 * deriveAesKey / createPinVerifier) which is memory-hard.
 */
export async function sha256(input: string): Promise<ArrayBuffer> {
  const cryptoApi = typeof crypto !== 'undefined' ? crypto : window.crypto
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  return cryptoApi.subtle.digest('SHA-256', data)
}
