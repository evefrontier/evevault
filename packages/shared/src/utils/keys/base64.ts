/**
 * Base64 ⇄ raw-bytes codec used by the key encryption layer.
 *
 * Uses `atob`/`btoa` over a one-byte-per-char "binary string" so that the
 * encoding matches everywhere the encrypted vault fields are read or written
 * (encrypt, decrypt, key derivation, and their tests). Keep these as the single
 * source of truth rather than reaching for a different base64 implementation —
 * mismatched codecs would silently corrupt the stored ciphertext.
 */

export const bytesToB64 = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))

export const b64ToBytes = (b64: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
