export async function encrypt(string: string, pin: string) {
  // Use global crypto (available in service workers) or window.crypto (available in browser)
  const cryptoApi = typeof crypto !== "undefined" ? crypto : window.crypto;

  // Generate a random salt for PBKDF2 key derivation
  const salt = cryptoApi.getRandomValues(new Uint8Array(16));

  // Derive a strong AES key from the PIN using PBKDF2 (100,000 iterations)
  // This makes offline brute-force attacks against weak PINs computationally expensive
  const keyMaterial = await cryptoApi.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  const aesKey = await cryptoApi.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );

  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const encryptedData = await cryptoApi.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    new TextEncoder().encode(string),
  );

  return {
    iv: btoa(String.fromCharCode(...iv)),
    data: btoa(String.fromCharCode(...new Uint8Array(encryptedData))),
    salt: btoa(String.fromCharCode(...salt)),
  };
}
