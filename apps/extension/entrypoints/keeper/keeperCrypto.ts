import { decrypt, deriveAesKey, type HashedData } from "@evevault/shared";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { BackgroundMessage } from "@/lib/background/types";
import {
  localnetState,
  setSessionKey,
  unlockVaultWithKeypair,
} from "./keeperState";

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export function publicKeyBytes(keypair: Ed25519Keypair | null): number[] {
  return Array.from(keypair?.getPublicKey().toRawBytes() ?? []);
}

function saltBytesFrom(hashedSecretKey: HashedData): Uint8Array {
  return Uint8Array.from(atob(hashedSecretKey.salt), (c) => c.charCodeAt(0));
}

export async function cacheSessionKey(
  pin: string,
  hashedSecretKey: HashedData,
): Promise<void> {
  const derivedKey = await deriveAesKey(pin, saltBytesFrom(hashedSecretKey), [
    "encrypt",
  ]);
  setSessionKey(derivedKey, hashedSecretKey.salt);
}

export async function restoreLocalnetKeyIfPresent(
  message: BackgroundMessage,
  pin: string,
): Promise<void> {
  /*
   * Older unlock paths may include an encrypted localnet key alongside the
   * zkLogin secret. Failure to restore it should not block the main vault
   * unlock because localnet is a dev-only capability.
   */
  const encLocalnet = (message as { encryptedLocalnetKey?: unknown })
    .encryptedLocalnetKey;

  if (
    !encLocalnet ||
    typeof encLocalnet !== "object" ||
    !("data" in encLocalnet)
  ) {
    return;
  }

  try {
    const localnetPrivKey = await decrypt(encLocalnet as HashedData, pin);
    localnetState.localnetKey = Ed25519Keypair.fromSecretKey(localnetPrivKey);
  } catch {
    localnetState.localnetKey = null;
  }
}

export async function decryptVaultSecret(
  hashedSecretKey: HashedData,
  pin: string,
): Promise<string> {
  return decrypt(hashedSecretKey, pin);
}

export async function restoreUnlockedVault(
  message: BackgroundMessage,
  secretKey: string,
  hashedSecretKey: HashedData,
  pin: string,
): Promise<void> {
  // Keep these operations together so unlock state and rotation state match.
  unlockVaultWithKeypair(Ed25519Keypair.fromSecretKey(secretKey));
  await cacheSessionKey(pin, hashedSecretKey);
  await restoreLocalnetKeyIfPresent(message, pin);
}
