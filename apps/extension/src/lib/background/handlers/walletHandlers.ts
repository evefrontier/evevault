import { createLogger } from "@evevault/shared/utils";
import type { WalletActionMessage } from "../types";

const log = createLogger();

async function openPopupWindow(url: string): Promise<number | undefined> {
  try {
    const popupUrl = chrome.runtime.getURL(`${url}.html`);

    // Open as a standalone window
    const window = await chrome.windows.create({
      url: popupUrl,
      type: "popup",
      width: 500,
      height: 500,
      focused: true,
    });

    return window.id;
  } catch (error) {
    log.error("Failed to open popup", error);
    return undefined;
  }
}

async function handleApprovePopup(
  message: WalletActionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): Promise<boolean> {
  // Return boolean to indicate async response

  const { action } = message;

  try {
    log.info("Wallet action request received", { action: message.action });

    const senderTabId = sender.tab?.id;

    // Open popup for user approval
    const windowId = await openPopupWindow(action);

    if (!windowId) {
      throw new Error("Failed to open approval popup");
    }

    // Store the transaction request
    await chrome.storage.local.set({
      pendingAction: {
        ...message,
        windowId,
        senderTabId,
        timestamp: Date.now(),
      },
    });

    const storageListener = (changes: {
      [key: string]: chrome.storage.StorageChange;
    }) => {
      const result = changes.transactionResult?.newValue;

      if (result?.status === "signed" && senderTabId) {
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

        chrome.storage.local.remove([
          "pendingTransaction",
          "transactionResult",
        ]);

        chrome.storage.onChanged.removeListener(storageListener);
      } else if (result?.status === "error") {
        chrome.storage.onChanged.removeListener(storageListener);

        sendResponse({
          type: "sign_transaction_error",
          error: result.error,
        });

        chrome.storage.local.remove([
          "pendingTransaction",
          "transactionResult",
        ]);
      }
    };

    chrome.storage.onChanged.addListener(storageListener);

    // Clean up after timeout
    setTimeout(
      () => {
        chrome.storage.onChanged.removeListener(storageListener);
      },
      10 * 60 * 1000,
    );

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
