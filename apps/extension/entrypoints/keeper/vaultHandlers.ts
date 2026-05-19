import { encrypt, encryptWithKey, type HashedData } from "@evevault/shared";
import { signWithIntent } from "@evevault/shared/wallet";
import type { IntentScope } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { BackgroundMessage } from "@/lib/background/types";
import {
  cacheSessionKey,
  decryptVaultSecret,
  getErrorMessage,
  publicKeyBytes,
  restoreUnlockedVault,
} from "./keeperCrypto";
import {
  checkAndEnforceExpiry,
  getEphemeralKey,
  getSessionKey,
  lockVault,
  replaceEphemeralKey,
  unlockVaultWithKeypair,
} from "./keeperState";
import type { KeeperSendResponse } from "./keeperTypes";

export function handleCreateKeypair(
  message: BackgroundMessage,
  sendResponse: KeeperSendResponse,
): boolean {
  const pin = message.pin as string;
  const keypair = Ed25519Keypair.generate();
  unlockVaultWithKeypair(keypair);

  // Chrome keeps the response channel open only when the listener returns true.
  (async () => {
    try {
      const hashedSecretKey = await encrypt(keypair.getSecretKey(), pin);
      await cacheSessionKey(pin, hashedSecretKey);

      sendResponse({
        ok: true,
        hashedSecretKey,
        publicKeyBytes: publicKeyBytes(keypair),
      });
    } catch (error) {
      sendResponse({ ok: false, error: getErrorMessage(error) });
    }
  })();

  return true;
}

export function handleUnlockVault(
  message: BackgroundMessage,
  sendResponse: KeeperSendResponse,
): boolean {
  const hashedSecretKey = message.hashedSecretKey as HashedData;
  const pin = message.pin as string;

  (async () => {
    let secretKey: string;
    try {
      secretKey = await decryptVaultSecret(hashedSecretKey, pin);
    } catch (error) {
      console.error("[Keeper] Decryption failed:", error);
      sendResponse({
        ok: false,
        error: `[Keeper] Decryption failed: ${getErrorMessage(error)}`,
      });
      return;
    }

    try {
      await restoreUnlockedVault(message, secretKey, hashedSecretKey, pin);
      sendResponse({ ok: true });
    } catch (error) {
      console.error("[Keeper] Keypair creation failed:", error);
      sendResponse({
        ok: false,
        error: `[Keeper] Failed to create keypair: ${getErrorMessage(error)}`,
      });
    }
  })();

  return true;
}

export function handleGetPublicKey(
  _message: BackgroundMessage,
  sendResponse: KeeperSendResponse,
): boolean {
  if (checkAndEnforceExpiry()) {
    sendResponse({ error: "LOCKED" });
    return false;
  }

  sendResponse({ ok: true, publicKeyBytes: publicKeyBytes(getEphemeralKey()) });
  return false;
}

export function handleRotateKeypair(
  _message: BackgroundMessage,
  sendResponse: KeeperSendResponse,
): boolean {
  const sessionKey = getSessionKey();
  if (checkAndEnforceExpiry() || !sessionKey) {
    sendResponse({
      ok: false,
      error: "Vault must be unlocked again before rotating keypair",
    });
    return false;
  }

  (async () => {
    try {
      const newKeypair = Ed25519Keypair.generate();
      const hashedSecretKey = await encryptWithKey(
        newKeypair.getSecretKey(),
        sessionKey.derivedKey,
        sessionKey.salt,
      );

      // Swap only after encryption succeeds so storage and RAM never diverge.
      replaceEphemeralKey(newKeypair);

      sendResponse({
        ok: true,
        hashedSecretKey,
        publicKeyBytes: publicKeyBytes(newKeypair),
      });
    } catch (error) {
      sendResponse({ ok: false, error: getErrorMessage(error) });
    }
  })();

  return true;
}

export function handleEphSign(
  message: BackgroundMessage,
  sendResponse: KeeperSendResponse,
): boolean {
  const key = getEphemeralKey();
  if (checkAndEnforceExpiry() || !key) {
    sendResponse({ error: "[KEEPER_EPH_SIGN] LOCKED" });
    return false;
  }

  // Capture the current key before async work so a later lock does not mutate it.
  (async () => {
    try {
      const { msgBytes, scope, sui_address } = message;
      const ephSignature = await signWithIntent(
        new Uint8Array(msgBytes as number[]),
        scope as IntentScope,
        {
          sui_address: sui_address as string,
          keypair: key,
        },
      );

      sendResponse({
        ok: true,
        bytes: ephSignature.bytes,
        userSignature: ephSignature.userSignature,
      });
    } catch (error) {
      sendResponse({ ok: false, error: getErrorMessage(error) });
    }
  })();

  return true;
}

export function handleClearEphKey(
  _message: BackgroundMessage,
  sendResponse: KeeperSendResponse,
): boolean {
  lockVault();
  sendResponse({ ok: true });
  return false;
}
