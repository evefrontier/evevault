import { LOCALNET_KEY_STORAGE_KEY } from "@evevault/shared";
import { KeeperMessageTypes } from "@evevault/shared/types";

import type { VaultMessage } from "../types";
import { sendToKeeper } from "./vaultHandlers";

// ─── Localnet dev signing ────────────────────────────────────────────────────

export function _handleLocalnetSetKeypair(
  message: VaultMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean {
  (async () => {
    try {
      const response = await sendToKeeper({
        type: KeeperMessageTypes.LOCALNET_SET_KEYPAIR,
        privateKey: message.privateKey,
      });
      if (response?.ok) {
        // Persist raw key in background storage so it survives keeper restarts
        chrome.storage.local.set({
          [LOCALNET_KEY_STORAGE_KEY]: message.privateKey ?? "",
        });
      }
      sendResponse(response);
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  })();
  return true;
}

export async function _handleLocalnetGetAddress(
  _message: VaultMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): Promise<boolean> {
  try {
    const response = await sendToKeeper({
      type: KeeperMessageTypes.LOCALNET_GET_ADDRESS,
    });
    sendResponse(response);
  } catch {
    sendResponse({ ok: false, address: null });
  }
  return true;
}

export async function _handleLocalnetSignBytes(
  message: VaultMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): Promise<boolean> {
  const { msgBytes, scope, suiAddress } = message;

  try {
    const response = await sendToKeeper({
      type: KeeperMessageTypes.LOCALNET_SIGN,
      msgBytes: Array.isArray(msgBytes)
        ? msgBytes
        : Array.from(
            msgBytes instanceof Uint8Array
              ? msgBytes
              : Object.values(msgBytes as Record<number, number>),
          ),
      scope,
      suiAddress,
    });

    if (response?.ok && response?.bytes && response?.signature) {
      sendResponse({
        ok: true,
        bytes: response.bytes,
        signature: response.signature,
      });
    } else {
      sendResponse({
        ok: false,
        error: response?.error ?? "localnet sign failed",
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
