/**
 * Base64 ⇄ raw-bytes codec used by the key encryption layer.
 *
 * Uses `atob`/`btoa` over a one-byte-per-char "binary string" so that the
 * encoding matches everywhere the encrypted vault fields are read or written
 * (encrypt, decrypt, key derivation, and their tests). Keep these as the single
 * source of truth rather than reaching for a different base64 implementation —
 * mismatched codecs would silently corrupt the stored ciphertext.
 */

export const bytesToB64 = (bytes: Uint8Array): string => {
  // Chunk the conversion so we never spread an unbounded number of args into
  // String.fromCharCode (RangeError on large blobs) — 0x8000 is the common safe size.
  const CHUNK = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

export const b64ToBytes = (b64: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
