import { WalletStandardMessageTypes } from "@evevault/shared";
import { getJwtForNetwork, getStoredChain } from "@evevault/shared/auth";
import { createLogger } from "@evevault/shared/utils";
import { openPopupWindow } from "../services/popupWindow";
import type {
  EveFrontierSponsoredTransactionMessage,
  SponsoredTxReturn,
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
  _sendResponse: (response?: unknown) => void,
): Promise<boolean> {
  const senderTabId = sender.tab?.id;
  const { action, assembly, assemblyType } = message.message;

  try {
    const chain = await getStoredChain();
    const jwt = await getJwtForNetwork(chain);
    if (!jwt?.id_token) {
      const error = "No JWT for current network. Re-authenticate required.";
      if (senderTabId != null) {
        chrome.tabs
          .sendMessage(senderTabId, {
            type: "sign_sponsored_transaction_error",
            error,
            id: message.id,
          })
          .catch((err) => {
            log.error("Failed to send error message to tab", err);
          });
      } else {
        log.warn("No sender tab id, cannot send JWT error to page", { error });
      }
      return true;
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
    const encodedTier = encodeURIComponent(import.meta.env.VITE_QUASAR_TIER);

    const response = await fetch(
      `https://api.${encodedTier}.tech.evefrontier.com/transactions/sponsored/${encodedAssemblyType}/${encodedAction}`,
      {
        method: "POST",
        body: JSON.stringify({
          assemblyId: assembly,
        }),
        headers: {
          "X-Tenant": import.meta.env.VITE_FRONTIER_TENANT,
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt.id_token}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch txb: ${response.statusText}`);
    }

    const sponsoredTxReturn = (await response.json()) as SponsoredTxReturn;

    const actionType =
      WalletStandardMessageTypes.EVEFRONTIER_SIGN_SPONSORED_TRANSACTION;
    const windowId = await openPopupWindow(actionType);

    if (!windowId) {
      throw new Error("Failed to open sponsored transaction popup");
    }

    await chrome.storage.local.set({
      pendingAction: {
        action: actionType,
        id: message.id,
        senderTabId,
        timestamp: Date.now(),
        windowId,
        sponsoredTxB64: sponsoredTxReturn.bcsDataB64Bytes,
        preparationId: sponsoredTxReturn.preparationId,
        chain,
      },
    });

    const storageListener = (changes: {
      [key: string]: chrome.storage.StorageChange;
    }) => {
      const result = changes.transactionResult?.newValue;
      if (!result || result.windowId !== windowId) return;

      chrome.storage.onChanged.removeListener(storageListener);
      chrome.storage.local.remove(["pendingAction", "transactionResult"]);

      if (
        result.status === "signed" &&
        result.zkSignature != null &&
        result.preparationId != null &&
        senderTabId != null
      ) {
        (async () => {
          try {
            const executeResponse = await fetch(
              `https://api.${encodedTier}.tech.evefrontier.com/transactions/sponsored/execute`,
              {
                method: "POST",
                body: JSON.stringify({
                  preparationId: result.preparationId,
                  userSignatureB64Bytes: result.zkSignature,
                }),
                headers: {
                  "X-Tenant": import.meta.env.VITE_FRONTIER_TENANT,
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${jwt.id_token}`,
                },
              },
            );

            if (!executeResponse.ok) {
              throw new Error(
                `Sponsored execute failed: ${executeResponse.status} ${executeResponse.statusText}`,
              );
            }

            const executeResult = (await executeResponse.json()) as {
              digest?: string;
              effects?: string;
              [key: string]: unknown;
            };
            const digest = executeResult.digest ?? "0x0";
            const effects = executeResult.effects ?? "0x0";

            await chrome.tabs.sendMessage(senderTabId, {
              type: "sign_success",
              digest,
              effects,
              id: message.id,
            });
          } catch (err) {
            log.error("Sponsored execute failed", err);
            const errorMessage =
              err instanceof Error ? err.message : "Unknown error occurred";
            await chrome.tabs.sendMessage(senderTabId, {
              type: "sign_sponsored_transaction_error",
              error: errorMessage,
              id: message.id,
            });
          }
        })();
      } else if (result.status === "error" && senderTabId != null) {
        chrome.tabs
          .sendMessage(senderTabId, {
            type: "sign_sponsored_transaction_error",
            error: result.error ?? "Transaction rejected or failed",
            id: message.id,
          })
          .catch((err) => {
            log.error("Failed to send error message to tab", err);
          });
      }
    };

    chrome.storage.onChanged.addListener(storageListener);
    setTimeout(
      () => chrome.storage.onChanged.removeListener(storageListener),
      10 * 60 * 1000,
    );

    return true;
  } catch (error) {
    log.error("Transaction signing failed", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    if (senderTabId != null) {
      chrome.tabs
        .sendMessage(senderTabId, {
          type: "sign_sponsored_transaction_error",
          error: errorMessage,
          id: message.id,
        })
        .catch((err) => {
          log.error("Failed to send error message to tab", err);
        });
    } else {
      log.warn("No sender tab id, cannot send error to page", {
        error: errorMessage,
      });
    }
    return true;
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
