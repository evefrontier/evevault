import { createLogger, KeeperMessageTypes } from "@evevault/shared";
import { ensureOffscreen } from "../services/offscreenService";
import type { VaultMessage } from "../types";

const log = createLogger();

/**
 * Sends a message to the keeper and returns the response
 * Retries if the keeper isn't ready yet
 */
async function sendToKeeper(message: any, retries = 3): Promise<any> {
  await ensureOffscreen(true);

  return new Promise((resolve, reject) => {
    const attemptSend = (attempt: number) => {
      chrome.runtime.sendMessage(
        { ...message, target: "KEEPER" },
        (response) => {
          if (chrome.runtime.lastError) {
            const error = chrome.runtime.lastError.message;

            // If port closed and we have retries left, wait and retry
            if (error.includes("port closed") && attempt < retries) {
              log.info(
                `Keeper not ready yet, retrying... (attempt ${
                  attempt + 1
                }/${retries})`,
              );
              setTimeout(() => attemptSend(attempt + 1), 200 * attempt); // Exponential backoff
              return;
            }

            reject(new Error(error));
            return;
          }
          resolve(response);
        },
      );
    };

    attemptSend(1);
  });
}

/**
 * Handles UNLOCK_VAULT message - decrypts and loads the ephemeral key into keeper
 */
export async function handleUnlockVault(
  message: VaultMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): Promise<boolean | undefined> {
  const { hashedSecretKey, pin, unlockDurationMs } = message;

  // Validate that we have a key to decrypt
  if (!hashedSecretKey) {
    sendResponse({
      ok: false,
      error:
        "No secret key provided. Cannot unlock vault without an existing key. Create a new key pair first.",
    });
    return true;
  }

  try {
    const keeperResponse = await sendToKeeper({
      type: KeeperMessageTypes.UNLOCK_VAULT,
      hashedSecretKey: hashedSecretKey,
      pin,
    });

    console.log("[VaultHandler] Keeper response:", keeperResponse);

    if (keeperResponse?.ok) {
      sendResponse({ ok: true });
    } else {
      const errorMessage = keeperResponse?.error || "Failed to unlock vault";
      console.error("[VaultHandler] Unlock failed:", errorMessage);
      sendResponse({
        ok: false,
        error: errorMessage,
      });
    }

    return true;
  } catch (error) {
    console.error("[VaultHandler] Error decrypting secret key:", error);
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Handles LOCK message - locks the vault and clears the ephemeral key and zkProofs
 */
export async function handleLock(
  _message: VaultMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): Promise<boolean | undefined> {
  try {
    const keeperResponse = await sendToKeeper({
      type: KeeperMessageTypes.CLEAR_EPHKEY,
    });

    log.info("[VaultHandler] Keeper response:", keeperResponse);

    if (keeperResponse?.ok) {
      sendResponse({ ok: true });
    } else {
      const errorMessage = keeperResponse?.error || "Failed to lock vault";
      console.error("[VaultHandler] Lock failed:", errorMessage);
      sendResponse({
        ok: false,
        error: errorMessage,
      });
    }
  } catch (error) {
    console.error("[VaultHandler] Error locking vault:", error);
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

  return true;
}

/**
 * Handles CREATE_KEYPAIR message - generates a new ephemeral key pair
 */
export function _handleCreateKeypair(
  message: VaultMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean {
  const { pin } = message;

  // Start async operation but return true immediately to keep channel open
  (async () => {
    try {
      const keeperResponse = await sendToKeeper({
        type: KeeperMessageTypes.CREATE_KEYPAIR,
        pin,
      });

      if (keeperResponse?.ok) {
        sendResponse({
          ok: true,
          hashedSecretKey: keeperResponse.hashedSecretKey,
          publicKeyBytes: keeperResponse.publicKeyBytes,
        });
      } else {
        sendResponse({
          ok: false,
          error: keeperResponse?.error || "Failed to set key in keeper",
        });
      }
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  })();

  return true; // Return synchronously to keep channel open
}

/**
 * Handles GET_PUBLIC_KEY message - returns the current ephemeral public key from keeper
 */
export async function _handleGetPublicKey(
  _message: VaultMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): Promise<boolean> {
  try {
    const response = await sendToKeeper({
      type: KeeperMessageTypes.GET_PUBLIC_KEY,
    });

    if (response?.ok && response?.publicKeyBytes) {
      sendResponse({
        ok: true,
        publicKeyBytes: response.publicKeyBytes,
      });
    } else {
      sendResponse({
        error: response?.error || "EVE Vault is LOCKED",
      });
    }
  } catch (error) {
    sendResponse({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

  return true;
}

/**
 * Handles ZK_EPH_SIGN_BYTES message - signs bytes with the ephemeral key from keeper
 */
export async function _handleZkEphSignBytes(
  message: VaultMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): Promise<boolean> {
  const { msgBytes, scope, sui_address } = message;

  try {
    // Forward the signing request to the keeper
    const response = await sendToKeeper({
      type: KeeperMessageTypes.EPH_SIGN,
      msgBytes: Array.isArray(msgBytes)
        ? msgBytes
        : Array.from(
            msgBytes instanceof Uint8Array
              ? msgBytes
              : Object.values(msgBytes as Record<number, number>),
          ),
      scope,
      sui_address,
    });

    if (response?.ok && response?.bytes && response?.userSignature) {
      sendResponse({
        ok: true,
        bytes: response.bytes,
        userSignature: response.userSignature,
      });
    } else {
      sendResponse({
        ok: false,
        error: response?.error || "[VaultHandler] Failed to sign bytes",
      });
    }
  } catch (error) {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

  return true;
}

/**
 * Handles SET_ZKPROOF message - stores zkProof in keeper for a specific chain
 */
export async function _handleSetZkProof(
  message: VaultMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): Promise<boolean> {
  const { chain, zkProof } = message;

  try {
    const response = await sendToKeeper({
      type: "KEEPER_SET_ZKPROOF",
      chain,
      zkProof,
    });

    if (response?.ok) {
      sendResponse({ ok: true });
    } else {
      sendResponse({
        ok: false,
        error: response?.error || "Failed to set zkProof in keeper",
      });
    }
  } catch (error) {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

  return true;
}

/**
 * Handles GET_ZKPROOF message - retrieves zkProof from keeper for a specific chain
 */
export async function _handleGetZkProof(
  message: VaultMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): Promise<boolean> {
  const { chain } = message;

  try {
    const response = await sendToKeeper({
      type: KeeperMessageTypes.GET_ZKPROOF,
      chain,
    });

    if (response?.ok) {
      sendResponse({
        ok: true,
        zkProof: response.zkProof,
      });
    } else {
      sendResponse({
        ok: false,
        error: response?.error || "Failed to get zkProof from keeper",
        zkProof: null,
      });
    }
  } catch (error) {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
      zkProof: null,
    });
  }

  return true;
}

/**
 * Handles CLEAR_ZKPROOF message - clears zkProofs from keeper
 */
export async function _handleClearZkProof(
  _message: VaultMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): Promise<boolean> {
  try {
    const response = await sendToKeeper({
      type: KeeperMessageTypes.CLEAR_ZKPROOF,
    });

    if (response?.ok) {
      sendResponse({
        ok: true,
        zkProof: response.zkProof,
      });
    } else {
      sendResponse({
        ok: false,
        error: response?.error || "Failed to get zkProof from keeper",
        zkProof: null,
      });
    }
  } catch (error) {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
      zkProof: null,
    });
  }

  return true;
}
