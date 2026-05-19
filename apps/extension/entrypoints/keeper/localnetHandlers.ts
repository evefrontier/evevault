import type { BackgroundMessage } from "@/lib/background/types";
import { getSessionKey, localnetState } from "./keeperState";
import type { KeeperSendResponse } from "./keeperTypes";
import { localnetGetAddress, localnetSetKeypair, localnetSign } from "./local";

export function handleLocalnetSetKeypair(
  message: BackgroundMessage,
  sendResponse: KeeperSendResponse,
): boolean {
  const sessionKey = getSessionKey();

  if (!sessionKey) {
    sendResponse({
      ok: false,
      error: "Vault must be unlocked to store localnet key",
    });
    return false;
  }

  localnetSetKeypair(
    localnetState,
    sessionKey.derivedKey,
    sessionKey.salt,
    message,
    sendResponse,
  );
  return true;
}

export function handleLocalnetGetAddress(
  _message: BackgroundMessage,
  sendResponse: KeeperSendResponse,
): boolean {
  localnetGetAddress(localnetState, sendResponse);
  return false;
}

export function handleLocalnetSign(
  message: BackgroundMessage,
  sendResponse: KeeperSendResponse,
): boolean {
  localnetSign(localnetState, message, sendResponse);
  return true;
}
