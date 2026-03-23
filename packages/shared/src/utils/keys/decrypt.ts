import type { HashedData } from "../../types/stores";
import {
  AES_KEY_LENGTH,
  PBKDF2_HASH_ALGORITHM,
  PBKDF2_ITERATIONS,
} from "./constants";

export async function decrypt(encryptedKey: HashedData, pin: string) {
  // Use global crypto (available in service workers) or window.crypto (available in browser)
  const cryptoApi = typeof crypto !== "undefined" ? crypto : window.crypto;

  const salt = Uint8Array.from(atob(encryptedKey.salt), (c) => c.charCodeAt(0));
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
      iterations: PBKDF2_ITERATIONS,
      hash: PBKDF2_HASH_ALGORITHM,
    },
    keyMaterial,
    { name: "AES-GCM", length: AES_KEY_LENGTH },
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
