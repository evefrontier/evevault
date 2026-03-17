import { WalletStandardMessageTypes } from "@evevault/shared";
import { createLogger } from "@evevault/shared/utils";
import { openPopupWindow } from "../services/popupWindow";
import type { WalletActionMessage } from "../types";
import {
  hasPendingForTab,
  processNextWalletRequest,
  setTabInProgress,
} from "./walletRequestQueue";

const log = createLogger();

async function handleApprovePopup(
  message: WalletActionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): Promise<boolean> {
  const { action } = message;

  try {
    log.info("Wallet action request received", { action: message.action });

    const senderTabId = sender.tab?.id;

    if (senderTabId != null && hasPendingForTab(senderTabId)) {
      const { enqueue } = await import("./walletRequestQueue");
      enqueue(senderTabId, { kind: "sign", message, sender, sendResponse });
      log.info("Sign request queued for tab", { senderTabId, action });
      log.debug("Sign request queued for tab", { senderTabId, action });
      return true;
    }

    // Mark tab in-progress BEFORE awaiting to prevent race condition
    if (senderTabId != null) setTabInProgress(senderTabId);

    const windowId = await openPopupWindow(action);

    if (!windowId) {
      // Clear in-progress flag if popup creation failed
      if (senderTabId != null) {
        const { clearTabInProgress } = await import("./walletRequestQueue");
        clearTabInProgress(senderTabId);
      }
      throw new Error("Failed to open approval popup");
    }

    await chrome.storage.local.set({
      pendingAction: {
        ...message,
        windowId,
        senderTabId,
        timestamp: Date.now(),
      },
    });

    const isSignAndExecute =
      action === WalletStandardMessageTypes.SIGN_AND_EXECUTE_TRANSACTION;

    const storageListener = (changes: {
      [key: string]: chrome.storage.StorageChange;
    }) => {
      const result = changes.transactionResult?.newValue;

      const isSuccess =
        result?.status === "signed" || result?.status === "signed_and_executed";
      if (isSuccess && senderTabId) {
        if (isSignAndExecute) {
          const hasRequired =
            result.bytes != null &&
            result.signature != null &&
            result.digest != null &&
            result.effects != null;
          if (!hasRequired) {
            chrome.tabs
              .sendMessage(senderTabId, {
                type: "sign_and_execute_transaction_error",
                error: "Missing bytes or signature in transaction result",
                id: message.id,
              })
              .catch((err) => {
                log.error("Failed to send sign_and_execute error", err);
              });
          } else {
            chrome.tabs
              .sendMessage(senderTabId, {
                type: "sign_and_execute_transaction_success",
                result: {
                  bytes: result.bytes,
                  signature: result.signature,
                  digest: result.digest,
                  effects: result.effects,
                },
                id: message.id,
              })
              .catch((err) => {
                log.error("Failed to send sign_and_execute success", err);
              });
          }
        } else {
          chrome.tabs
            .sendMessage(senderTabId, {
              type: "sign_success",
              bytes: result.bytes,
              signature: result.signature,
              id: message.id,
            })
            .catch((err) => {
              log.error("Failed to send success message", err);
            });
        }

        chrome.storage.local.remove(["pendingAction", "transactionResult"]);
        chrome.storage.onChanged.removeListener(storageListener);
        if (senderTabId != null) processNextWalletRequest(senderTabId);
      } else if (result?.status === "error") {
        chrome.storage.onChanged.removeListener(storageListener);

        if (isSignAndExecute && senderTabId) {
          chrome.tabs
            .sendMessage(senderTabId, {
              type: "sign_and_execute_transaction_error",
              error: result.error,
              id: message.id,
            })
            .catch((err) => {
              log.error("Failed to send sign_and_execute error", err);
            });
        } else {
          sendResponse({
            type: "sign_transaction_error",
            error: result.error,
          });
        }

        chrome.storage.local.remove(["pendingAction", "transactionResult"]);
        if (senderTabId != null) processNextWalletRequest(senderTabId);
      }
    };

    chrome.storage.onChanged.addListener(storageListener);

    // Clean up after timeout (10 minutes)
    const timeoutId = setTimeout(
      () => {
        chrome.storage.onChanged.removeListener(storageListener);
        chrome.storage.local.remove(["pendingAction", "transactionResult"]);
        log.warn("Transaction approval timed out", { action, senderTabId });
        // Clear in-progress and process next to prevent queue stall
        if (senderTabId != null) processNextWalletRequest(senderTabId);
      },
      10 * 60 * 1000,
    );

    // Store timeout ID so it can be cleared if transaction completes
    const originalListener = storageListener;
    const wrappedListener = (changes: {
      [key: string]: chrome.storage.StorageChange;
    }) => {
      clearTimeout(timeoutId);
      originalListener(changes);
    };
    chrome.storage.onChanged.removeListener(storageListener);
    chrome.storage.onChanged.addListener(wrappedListener);

    return true; // Keep message channel open for async response
  } catch (error) {
    log.error("Transaction signing failed", error);
    sendResponse({
      type: "sign_transaction_error",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
    return false;
  }
}

async function handleReportTransactionEffects(
  message: Record<string, unknown>,
  _sender: chrome.runtime.MessageSender,
  _sendResponse: (response?: unknown) => void,
): Promise<void> {
  log.debug("Report transaction effects request", message);

  // TODO: Implement transaction effects reporting
  chrome.runtime.sendMessage({
    type: "report_transaction_effects_error",
    error: "Transaction effects reporting not yet implemented",
  });
}

export { handleApprovePopup, handleReportTransactionEffects };
