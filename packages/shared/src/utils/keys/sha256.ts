/**
 * Computes SHA-256 hash of a string, returning raw bytes.
 * Use this when you need the hash as key material (e.g., for AES encryption).
 */
export async function sha256(input: string): Promise<ArrayBuffer> {
  const cryptoApi = typeof crypto !== "undefined" ? crypto : window.crypto;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  return cryptoApi.subtle.digest("SHA-256", data);
}

/**
 * Computes SHA-256 hash of a string, returning a hex string.
 * Use this when you need the hash for storage or comparison.
 */
export async function sha256Hex(input: string): Promise<string> {
  const hashBuffer = await sha256(input);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
