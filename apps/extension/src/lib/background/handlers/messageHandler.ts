import { VaultMessageTypes, WalletStandardMessageTypes } from '@evevault/shared'
import { createLogger } from '@evevault/shared/utils'
import type {
  BackgroundMessage,
  EveFrontierSponsoredTransactionMessage,
  VaultMessage,
  WalletActionMessage,
  WebUnlockMessage,
} from '@/lib/background/types'
import {
  handleDappLogin,
  handleExtLogin,
  handleWebUnlock,
} from './authHandlers'
import { handleSponsoredTransaction } from './sponsoredTransactionHandler'
import {
  _handleClearZkProof,
  _handleCreateKeypair,
  _handleGetPublicKey,
  _handleGetZkProof,
  _handleLocalnetGetAddress,
  _handleLocalnetSetKeypair,
  _handleLocalnetSignBytes,
  _handleRotateKeypair,
  _handleSetZkProof,
  _handleZkEphSignBytes,
  handleLock,
  handleUnlockVault,
} from './vaultHandlers'
import { handleApprovePopup } from './walletHandlers'

const log = createLogger()

type MsgSender = chrome.runtime.MessageSender
type SendResponse = (response?: unknown) => void

// Auth action handlers. 'connect' is keyed by message.type rather than action
// because the wallet-standard connect message arrives with type='connect', not action='connect'.
const AUTH_HANDLERS: Partial<
  Record<
    string,
    (
      m: BackgroundMessage,
      s: MsgSender,
      sr: SendResponse,
      tabId?: number,
    ) => void
  >
> = {
  ext_login: (m, s, sr) => handleExtLogin(m, s, sr),
  dapp_login: (m, s, sr, tabId) =>
    void handleDappLogin(m, s, sr, tabId).catch((e) =>
      log.error('handleDappLogin failed', e),
    ),
  connect: (m, s, sr, tabId) =>
    void handleDappLogin(m, s, sr, tabId).catch((e) =>
      log.error('handleDappLogin failed', e),
    ),
  web_unlock: (m, s, sr) =>
    void handleWebUnlock(m as WebUnlockMessage, s, sr).catch((e) =>
      log.error('handleWebUnlock failed', e),
    ),
}

// Wallet Standard action handlers — all keyed by the action field of the message.
const WALLET_ACTION_HANDLERS: Partial<
  Record<
    string,
    (m: BackgroundMessage, s: MsgSender, sr: SendResponse) => unknown
  >
> = {
  [WalletStandardMessageTypes.SIGN_PERSONAL_MESSAGE]: (m, s, sr) =>
    handleApprovePopup(m as WalletActionMessage, s, sr),
  [WalletStandardMessageTypes.SIGN_TRANSACTION]: (m, s, sr) =>
    handleApprovePopup(m as WalletActionMessage, s, sr),
  [WalletStandardMessageTypes.SIGN_AND_EXECUTE_TRANSACTION]: (m, s, sr) =>
    handleApprovePopup(m as WalletActionMessage, s, sr),
  [WalletStandardMessageTypes.EVEFRONTIER_SIGN_SPONSORED_TRANSACTION]: (
    m,
    s,
    sr,
  ) =>
    handleSponsoredTransaction(
      m as EveFrontierSponsoredTransactionMessage,
      s,
      sr,
    ),
}

// Vault message type handlers.
type VaultHandler = (m: VaultMessage, s: MsgSender, sr: SendResponse) => unknown
const VAULT_HANDLERS: Partial<Record<string, VaultHandler>> = {
  [VaultMessageTypes.UNLOCK_VAULT]: handleUnlockVault,
  [VaultMessageTypes.LOCK]: handleLock,
  [VaultMessageTypes.CREATE_KEYPAIR]: _handleCreateKeypair,
  [VaultMessageTypes.ROTATE_KEYPAIR]: _handleRotateKeypair,
  [VaultMessageTypes.GET_PUBLIC_KEY]: _handleGetPublicKey,
  [VaultMessageTypes.ZK_EPH_SIGN_BYTES]: _handleZkEphSignBytes,
  [VaultMessageTypes.SET_ZKPROOF]: _handleSetZkProof,
  [VaultMessageTypes.GET_ZKPROOF]: _handleGetZkProof,
  [VaultMessageTypes.CLEAR_ZKPROOF]: _handleClearZkProof,
  [VaultMessageTypes.LOCALNET_SET_KEYPAIR]: _handleLocalnetSetKeypair,
  [VaultMessageTypes.LOCALNET_GET_ADDRESS]: _handleLocalnetGetAddress,
  [VaultMessageTypes.LOCALNET_SIGN_BYTES]: _handleLocalnetSignBytes,
}

export function handleMessage(
  message: BackgroundMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) {
  const tabId = sender.tab?.id
  const { action, type } = message

  const authHandler = AUTH_HANDLERS[action ?? ''] ?? AUTH_HANDLERS[type ?? '']
  if (authHandler) {
    authHandler(message, sender, sendResponse, tabId)
    return true
  }

  const walletHandler = WALLET_ACTION_HANDLERS[action ?? '']
  if (walletHandler) return walletHandler(message, sender, sendResponse)

  const vaultHandler = VAULT_HANDLERS[type ?? '']
  if (vaultHandler) {
    vaultHandler(message as VaultMessage, sender, sendResponse)
    return true
  }

  if (message.event === 'change' && message.payload) {
    log.info('Broadcasting chain change event', message.payload)
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, {
            __from: 'Eve Vault',
            event: 'change',
            payload: message.payload,
          })
        }
      })
    })
    return
  }

  log.warn('Unknown background message', message)
}
