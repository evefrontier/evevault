import { createLogger } from "@evevault/shared/utils";
import type { MessageWithId } from "../types";
import { handleDappLogin } from "./auth/dappLogin";
import { handleExtLogin } from "./auth/extLogin";
import {
  clearPendingAuth,
  getPending,
  getPendingAndClear,
  sendPendingAuthError,
} from "./auth/pendingAuth";
import { handleWebUnlock } from "./auth/webUnlock";

const log = createLogger();

if (typeof chrome !== "undefined" && chrome.windows?.onRemoved) {
  chrome.windows.onRemoved.addListener((removedWindowId) => {
    const pending = getPending();
    if (pending?.windowId === removedWindowId) {
      clearPendingAuth();
      sendPendingAuthError(pending);
    }
  });
}

export function checkPendingAuthAfterUnlock(): void {
  const pending = getPendingAndClear();
  if (!pending) return;
  if (pending.type === "ext") {
    handleExtLogin(
      { action: "ext_login", id: pending.id } as MessageWithId,
      undefined as unknown as chrome.runtime.MessageSender,
      () => {},
    ).catch((error) => {
      log.error("Failed to resume extension login after unlock", error);
    });
  } else if (pending.tabId !== undefined) {
    handleDappLogin(
      { action: "dapp_login", id: pending.id } as MessageWithId,
      { tab: { id: pending.tabId } } as chrome.runtime.MessageSender,
      () => {},
      pending.tabId,
    ).catch((error) => {
      log.error("Failed to resume dapp login after unlock", error);
    });
  }
}

export { handleDappLogin, handleExtLogin, handleWebUnlock };
