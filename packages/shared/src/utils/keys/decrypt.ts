import type { HashedData } from "../../types/stores";
import { deriveAesKey } from "./encrypt";

export async function decrypt(encryptedKey: HashedData, pin: string) {
  const cryptoApi =
    typeof crypto !== "undefined" ? crypto : (window as Window).crypto;

  const salt = Uint8Array.from(atob(encryptedKey.salt), (c) => c.charCodeAt(0));
  const aesKey = await deriveAesKey(pin, salt, ["decrypt"]);

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
