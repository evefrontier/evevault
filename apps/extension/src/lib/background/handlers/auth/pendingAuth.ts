import { createLogger } from "@evevault/shared/utils";
import { sendAuthError } from "./authHelpers";

const log = createLogger();

/** Delay in ms before retrying keeper unlock check (gives unlock time to complete) */
export const KEEPER_RETRY_DELAY_MS = 100;

/** Time to wait for vault unlock before sending auth_error (2 minutes) */
export const PENDING_AUTH_TIMEOUT_MS = 2 * 60 * 1000;

export interface PendingAuthAfterUnlock {
  id: string;
  type: "ext" | "dapp";
  tabId?: number;
  windowId?: number;
  /** Extra connect request ids for same tab (all get auth_success when unlock completes). */
  additionalIds?: string[];
  /** Tenant id for ext_login resume (popup context tenant when vault was locked). */
  tenantId?: string;
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
    const ids = [pending.id, ...(pending.additionalIds ?? [])];
    for (const id of ids) {
      chrome.tabs
        .sendMessage(pending.tabId, {
          id,
          type: "auth_error",
          error: errorPayload,
        })
        .catch((err) => {
          log.error("Failed to send auth_error to tab", {
            tabId: pending.tabId,
            id,
            err,
          });
        });
    }
  }
}

/**
 * Adds a connect request id to the existing dapp pending for this tab.
 * @returns true if the id was added (no new popup should be opened)
 */
export function addPendingDappId(tabId: number, id: string): boolean {
  if (!pendingAuthAfterUnlock) return false;
  if (pendingAuthAfterUnlock.type !== "dapp") return false;
  if (pendingAuthAfterUnlock.tabId !== tabId) return false;
  if (!pendingAuthAfterUnlock.additionalIds) {
    pendingAuthAfterUnlock.additionalIds = [];
  }
  // Deduplicate: only add if not already present
  if (pendingAuthAfterUnlock.additionalIds.includes(id)) {
    return true; // Already tracked, still no new popup needed
  }
  pendingAuthAfterUnlock.additionalIds.push(id);
  return true;
}

export function setPendingAuthAfterUnlock(
  id: string,
  type: "ext" | "dapp",
  tabId?: number,
  windowId?: number,
  tenantId?: string,
): void {
  clearPendingAuth();
  pendingAuthAfterUnlock = {
    id,
    type,
    tabId,
    windowId,
    tenantId,
    additionalIds: undefined,
  };
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
