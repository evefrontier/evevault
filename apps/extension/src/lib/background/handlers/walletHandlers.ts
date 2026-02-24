import { WalletStandardMessageTypes } from "@evevault/shared";
import {
  getJwtForNetwork,
  getStoredChain,
  getStoredWalletAddress,
} from "@evevault/shared/auth";
import { createLogger } from "@evevault/shared/utils";
import { openPopupWindow } from "../services/popupWindow";
import type {
  EveFrontierSponsoredTransactionMessage,
  WalletActionMessage,
} from "../types";

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

    const windowId = await openPopupWindow(action);

    if (!windowId) {
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

async function handleSponsoredTransaction(
  message: EveFrontierSponsoredTransactionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): Promise<boolean> {
  const senderTabId = sender.tab?.id;
  const { action, assembly, assemblyType } = message.message;

  try {
    const chain = await getStoredChain();
    const jwt = await getJwtForNetwork(chain);
    if (!jwt?.access_token) {
      sendResponse({
        type: "sign_transaction_error",
        error: "No JWT for current network. Re-authenticate required.",
      });
      return false;
    }

    if (!assembly || !assemblyType) {
      throw new Error(`Assembly not found: ${assembly}, ${assemblyType}`);
    }

    log.info("Eve Frontier sponsored transaction request received", {
      action,
      assembly,
      assemblyType,
      chain,
    });

    const encodedAssemblyType = encodeURIComponent(assemblyType);
    const encodedAction = encodeURIComponent(action);

    // Fetch the txb to be signed from the Quasar proxy
    const response = await fetch(
      `https://api.test.tech.evefrontier.com/transactions/sponsored/${encodedAssemblyType}/${encodedAction}`,
      {
        method: "POST",
        body: JSON.stringify({
          assemblyId: assembly,
          ownerId: 5,
        }),
        headers: {
          "X-Tenant": import.meta.env.VITE_FRONTIER_TENANT,
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt.access_token}`,
        },
      },
    );

    const txb = await response.json();

    // Sign the transaction with the zkSignAny function
    // const { zkSignature, bytes } = await zkSignAny(
    //   "TransactionData",
    //   new Uint8Array(txb),
    //   {
    //     user,
    //     ephemeralPublicKey,
    //     maxEpoch,
    //     getZkProof,
    //   },
    // );

    // This is a temporary solution to send the success message to the tab
    // The actual tx digest will depend on the quasar service
    chrome.tabs
      .sendMessage(senderTabId as number, {
        type: "sign_success",
        digest: "0x1234567890",
        effects: "0x1234567890",
        txb,
        id: message.id,
      })
      .catch((err) => {
        log.error("Failed to send success message", err);
      });

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

export {
  handleApprovePopup,
  handleSponsoredTransaction,
  handleReportTransactionEffects,
};
