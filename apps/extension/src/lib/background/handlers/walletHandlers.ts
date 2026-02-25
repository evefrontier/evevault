import { WalletStandardMessageTypes, zkSignAny } from "@evevault/shared";
import {
  getJwtForNetwork,
  getStoredChain,
  useAuthStore,
} from "@evevault/shared/auth";
import {
  useDeviceStore,
  useNetworkStore,
  waitForDeviceHydration,
} from "@evevault/shared/stores";
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

    // Fetch the txb to be signed from the Quasar proxy
    const response = await fetch(
      `https://api.${encodedTier}.tech.evefrontier.com/transactions/sponsored/${encodedAssemblyType}/${encodedAction}`,
      {
        method: "POST",
        body: JSON.stringify({
          assemblyId: assembly,
          // ownerId: 5,
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

    await waitForDeviceHydration();

    const user = useAuthStore.getState().user;
    if (!user) {
      const error = "User not authenticated. Sign in and try again.";
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
        log.warn("No sender tab id, cannot send user error to page", { error });
      }
      return true;
    }

    const deviceStore = useDeviceStore.getState();
    const ephemeralPublicKey = deviceStore.ephemeralPublicKey;
    const maxEpoch = deviceStore.getMaxEpoch(chain);
    if (!ephemeralPublicKey || !maxEpoch) {
      const error = !ephemeralPublicKey
        ? "Device key not found. Unlock the wallet and try again."
        : "Max epoch not set for current network. Re-authenticate and try again.";
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
        log.warn("No sender tab id, cannot send device error to page", {
          error,
        });
      }
      return true;
    }

    const networkStore = useNetworkStore.getState();
    const previousChain = networkStore.chain;
    networkStore.forceSetChain(chain);

    let zkSignature: string;
    try {
      const getZkProof = () => useDeviceStore.getState().getZkProof();
      const txbBytes = new Uint8Array(
        Buffer.from(sponsoredTxReturn.bcsDataB64Bytes, "base64"),
      );
      const result = await zkSignAny("TransactionData", txbBytes, {
        user,
        ephemeralPublicKey,
        maxEpoch,
        getZkProof,
      });
      zkSignature = result.zkSignature;
    } finally {
      if (previousChain !== chain) {
        networkStore.forceSetChain(previousChain);
      }
    }

    // Then, send the txb to the quasar service
    const executeResponse = await fetch(
      `https://api.${encodedTier}.tech.evefrontier.com/transactions/sponsored/execute`,
      {
        method: "POST",
        body: JSON.stringify({
          preparationId: sponsoredTxReturn.preparationId,
          userSignatureB64Bytes: zkSignature,
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

    chrome.tabs
      .sendMessage(senderTabId as number, {
        type: "sign_success",
        digest,
        effects,
        id: message.id,
      })
      .catch((err) => {
        log.error("Failed to send success message", err);
      });

    return true; // Keep message channel open for async response
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
