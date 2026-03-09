import { WalletStandardMessageTypes } from "@evevault/shared";
import { getJwtForNetwork, getStoredChain } from "@evevault/shared/auth";
import { createLogger } from "@evevault/shared/utils";
import { decodeJwt } from "jose";
import type { IdTokenClaims } from "oidc-client-ts";
import { openPopupWindow } from "../services/popupWindow";
import type {
  EveFrontierSponsoredTransactionMessage,
  SponsoredTxReturn,
} from "../types";

const log = createLogger();

async function handleSponsoredTransaction(
  message: EveFrontierSponsoredTransactionMessage,
  sender: chrome.runtime.MessageSender,
  _sendResponse: (response?: unknown) => void,
): Promise<boolean> {
  const senderTabId = sender.tab?.id;
  const { action, assembly, assemblyType, metadata } = message.message;

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
      metadata,
    });

    if (metadata) {
      log.info("Sponsored transaction metadata", {
        name: metadata?.name,
        description: metadata?.description,
        url: metadata?.url,
      });
    }

    const encodedAssemblyType = encodeURIComponent(assemblyType);
    const encodedAction = encodeURIComponent(action);

    const decodedJwt = decodeJwt<IdTokenClaims>(jwt.id_token);
    const tier = decodedJwt.tier;
    const tenant = (decodedJwt.tenant as string) || "";

    const response = await fetch(
      `https://api.${tier}.tech.evefrontier.com/transactions/sponsored/${encodedAssemblyType}/${encodedAction}`,
      {
        method: "POST",
        body: JSON.stringify({
          assemblyId: assembly,
          name: metadata?.name,
          description: metadata?.description,
          url: metadata?.url,
        }),
        headers: {
          "X-Tenant": tenant,
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt.id_token}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch txb: ${response.statusText}`);
    }

    const raw = await response.json();
    if (
      raw == null ||
      typeof raw !== "object" ||
      typeof raw.bcsDataB64Bytes !== "string" ||
      typeof raw.preparationId !== "string"
    ) {
      throw new Error(
        "Sponsored tx API returned invalid shape: expected { bcsDataB64Bytes: string, preparationId: string }",
      );
    }
    const sponsoredTxReturn = raw as SponsoredTxReturn;

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
              `https://api.${tier}.tech.evefrontier.com/transactions/sponsored/execute`,
              {
                method: "POST",
                body: JSON.stringify({
                  preparationId: result.preparationId,
                  userSignatureB64Bytes: result.zkSignature,
                }),
                headers: {
                  "X-Tenant": tenant,
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

export { handleSponsoredTransaction };
