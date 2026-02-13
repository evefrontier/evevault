import { sendAuthError } from "./authHelpers";

/** Delay in ms before retrying keeper unlock check (gives unlock time to complete) */
export const KEEPER_RETRY_DELAY_MS = 100;

/** Time to wait for vault unlock before sending auth_error (2 minutes) */
export const PENDING_AUTH_TIMEOUT_MS = 2 * 60 * 1000;

export interface PendingAuthAfterUnlock {
  id: string;
  type: "ext" | "dapp";
  tabId?: number;
  windowId?: number;
}

let pendingAuthAfterUnlock: PendingAuthAfterUnlock | null = null;
let pendingAuthTimeoutId: ReturnType<typeof setTimeout> | null = null;

export function clearPendingAuth(): void {
  if (pendingAuthTimeoutId !== null) {
    clearTimeout(pendingAuthTimeoutId);
    pendingAuthTimeoutId = null;
  }
  pendingAuthAfterUnlock = null;
}

export function sendPendingAuthError(pending: PendingAuthAfterUnlock): void {
  const errorPayload = {
    message: "Vault unlock was cancelled or timed out.",
  };
  if (pending.type === "ext") {
    sendAuthError(pending.id, errorPayload);
  } else if (pending.tabId !== undefined) {
    chrome.tabs.sendMessage(pending.tabId, {
      id: pending.id,
      type: "auth_error",
      error: errorPayload,
    });
  }
}

export function setPendingAuthAfterUnlock(
  id: string,
  type: "ext" | "dapp",
  tabId?: number,
  windowId?: number,
): void {
  clearPendingAuth();
  pendingAuthAfterUnlock = { id, type, tabId, windowId };
  pendingAuthTimeoutId = setTimeout(() => {
    pendingAuthTimeoutId = null;
    const pending = pendingAuthAfterUnlock;
    pendingAuthAfterUnlock = null;
    if (pending) {
      sendPendingAuthError(pending);
    }
  }, PENDING_AUTH_TIMEOUT_MS);
}

/** Returns the current pending auth without clearing (e.g. for window-close check). */
export function getPending(): PendingAuthAfterUnlock | null {
  return pendingAuthAfterUnlock;
}

/**
 * Returns the current pending auth and clears it. Used by the coordinator to
 * resume the appropriate handler after unlock.
 */
export function getPendingAndClear(): PendingAuthAfterUnlock | null {
  const pending = pendingAuthAfterUnlock;
  clearPendingAuth();
  return pending;
}
