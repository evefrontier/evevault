import type { HashedData } from "../../types/stores";
import { sha256 } from "./sha256";

export async function decrypt(encryptedKey: HashedData, pin: string) {
  // Use global crypto (available in service workers) or window.crypto (available in browser)
  const cryptoApi = typeof crypto !== "undefined" ? crypto : window.crypto;

  const keyMaterial = await sha256(pin);
  const aesKey = await cryptoApi.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );

  const iv = Uint8Array.from(atob(encryptedKey.iv), (c) => c.charCodeAt(0));
  const encryptedData = Uint8Array.from(atob(encryptedKey.data), (c) =>
    c.charCodeAt(0),
  );

  const decryptedData = await cryptoApi.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encryptedData,
  );

  return new TextDecoder().decode(decryptedData);
}
