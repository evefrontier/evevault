import {
  VaultMessageTypes,
  WalletStandardMessageTypes,
} from "@evevault/shared";
import { createLogger } from "@evevault/shared/utils";
import type { BackgroundMessage } from "../types";
import {
  handleDappLogin,
  handleExtLogin,
  handleWebUnlock,
} from "./authHandlers";
import {
  _handleClearZkProof,
  _handleCreateKeypair,
  _handleGetPublicKey,
  _handleGetZkProof,
  _handleSetZkProof,
  _handleZkEphSignBytes,
  handleLock,
  handleUnlockVault,
} from "./vaultHandlers";
import {
  handleApprovePopup,
  handleReportTransactionEffects,
} from "./walletHandlers";

const log = createLogger();

export function handleMessage(
  message: BackgroundMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) {
  const tabId = sender.tab?.id;
  const { action, type } = message;

  // Auth handlers
  if (action === "ext_login") {
    handleExtLogin(message, sender, sendResponse);
    return true;
  }

  if (action === "dapp_login" || type === "connect") {
    handleDappLogin(message, sender, sendResponse, tabId);
    return true;
  }

  if (action === "web_unlock") {
    handleWebUnlock(message, sender, sendResponse);
    return true;
  }

  // Wallet Standard handlers
  if (
    action === WalletStandardMessageTypes.SIGN_PERSONAL_MESSAGE ||
    action === WalletStandardMessageTypes.SIGN_TRANSACTION ||
    action === WalletStandardMessageTypes.SIGN_AND_EXECUTE_TRANSACTION
  ) {
    return handleApprovePopup(message, sender, sendResponse);
  }

  if (
    action === WalletStandardMessageTypes.EVEFRONTIER_SIGN_SPONSORED_TRANSACTION
  ) {
    return handleApprovePopup(message, sender, sendResponse);
  }

  if (action === "report_transaction_effects") {
    handleReportTransactionEffects(message, sender, sendResponse);
    return true;
  }

  // Vault handlers
  if (message.type === VaultMessageTypes.UNLOCK_VAULT) {
    handleUnlockVault(message, sender, sendResponse);
    return true;
  }

  if (message.type === VaultMessageTypes.LOCK) {
    handleLock(message, sender, sendResponse);
    return true;
  }

  if (message.type === VaultMessageTypes.CREATE_KEYPAIR) {
    _handleCreateKeypair(message, sender, sendResponse);
    return true;
  }

  if (message.type === VaultMessageTypes.GET_PUBLIC_KEY) {
    _handleGetPublicKey(message, sender, sendResponse);
    return true;
  }

  if (message.type === VaultMessageTypes.ZK_EPH_SIGN_BYTES) {
    _handleZkEphSignBytes(message, sender, sendResponse);
    return true;
  }

  if (message.type === VaultMessageTypes.SET_ZKPROOF) {
    _handleSetZkProof(message, sender, sendResponse);
    return true;
  }

  if (message.type === VaultMessageTypes.GET_ZKPROOF) {
    _handleGetZkProof(message, sender, sendResponse);
    return true;
  }

  if (message.type === VaultMessageTypes.CLEAR_ZKPROOF) {
    _handleClearZkProof(message, sender, sendResponse);
    return true;
  }

  // Handle change events
  // Forward chain change events to all tabs
  if (message.event === "change" && message.payload) {
    log.info("Broadcasting chain change event", message.payload);

    // Broadcast chain change to all tabs so the wallet can update
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, {
            __from: "Eve Vault",
            event: "change",
            payload: message.payload,
          });
        }
      });
    });
    return;
  }

  // Default case
  log.warn("Unknown background message", message);
}
