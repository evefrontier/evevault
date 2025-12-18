import { sha256 } from "./sha256";

export async function encrypt(string: string, pin: string) {
  // Use global crypto (available in service workers) or window.crypto (available in browser)
  const cryptoApi = typeof crypto !== "undefined" ? crypto : window.crypto;

  const keyMaterial = await sha256(pin);
  const aesKey = await cryptoApi.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "AES-GCM" },
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
  };
}
