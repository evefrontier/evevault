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
type SenderAccess = 'dapp' | 'extension'
type RouteContext = {
  message: BackgroundMessage
  sender: MsgSender
  sendResponse: SendResponse
  tabId?: number
}
type MessageRoute = {
  access: SenderAccess
  handle: (ctx: RouteContext) => unknown
}
type RegisteredMessageRoute = MessageRoute & {
  matches: (message: BackgroundMessage) => boolean
}
type RouteResolver = (message: BackgroundMessage) => MessageRoute | null

function runExtLogin({ message, sender, sendResponse }: RouteContext): true {
  void handleExtLogin(message, sender, sendResponse).catch((e) =>
    log.error('handleExtLogin failed', e),
  )
  return true
}

function runDappLogin({
  message,
  sender,
  sendResponse,
  tabId,
}: RouteContext): true {
  void handleDappLogin(message, sender, sendResponse, tabId).catch((e) =>
    log.error('handleDappLogin failed', e),
  )
  return true
}

function runWebUnlock({ message, sender, sendResponse }: RouteContext): true {
  void handleWebUnlock(message as WebUnlockMessage, sender, sendResponse).catch(
    (e) => log.error('handleWebUnlock failed', e),
  )
  return true
}

const AUTH_ROUTES: readonly RegisteredMessageRoute[] = [
  {
    access: 'extension',
    matches: (message) => message.action === 'ext_login',
    handle: runExtLogin,
  },
  {
    access: 'dapp',
    matches: (message) => message.type === 'connect',
    handle: runDappLogin,
  },
  {
    access: 'extension',
    matches: (message) => message.action === 'web_unlock',
    handle: runWebUnlock,
  },
]

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

function isExtensionSender(sender: MsgSender): boolean {
  if (sender.tab) return false

  const senderUrl = sender.url ?? ''
  if (!senderUrl) return true

  const extensionId = chrome.runtime?.id
  if (!extensionId) return senderUrl.startsWith('chrome-extension://')

  return senderUrl.startsWith(`chrome-extension://${extensionId}/`)
}

function isDappSender(sender: MsgSender): boolean {
  return typeof sender.tab?.id === 'number' && !isExtensionSender(sender)
}

function rejectUnauthorized(
  message: BackgroundMessage,
  sendResponse: SendResponse,
): false {
  log.warn('Rejected unauthorized background message', {
    action: message.action,
    type: message.type,
    event: message.event,
  })
  sendResponse({
    type: 'auth_error',
    error: { message: 'Unauthorized message sender' },
  })
  return false
}

function hasRequiredSender(sender: MsgSender, access: SenderAccess): boolean {
  return access === 'extension'
    ? isExtensionSender(sender)
    : isDappSender(sender)
}

function resolveAuthRoute(message: BackgroundMessage): MessageRoute | null {
  return AUTH_ROUTES.find((route) => route.matches(message)) ?? null
}

function resolveWalletRoute(message: BackgroundMessage): MessageRoute | null {
  const walletHandler = WALLET_ACTION_HANDLERS[message.action ?? '']

  return walletHandler
    ? {
        access: 'dapp',
        handle: ({ message, sender, sendResponse }) =>
          walletHandler(message, sender, sendResponse),
      }
    : null
}

function resolveVaultRoute(message: BackgroundMessage): MessageRoute | null {
  const vaultHandler = VAULT_HANDLERS[message.type ?? '']

  return vaultHandler
    ? {
        access: 'extension',
        handle: ({ message, sender, sendResponse }) => {
          vaultHandler(message as VaultMessage, sender, sendResponse)
          return true
        },
      }
    : null
}

function broadcastChangeEvent(payload: unknown): void {
  log.info('Broadcasting chain change event', payload)
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          __from: 'Eve Vault',
          event: 'change',
          payload,
        })
      }
    })
  })
}

function resolveChangeRoute(message: BackgroundMessage): MessageRoute | null {
  const hasChangePayload = message.event === 'change' && !!message.payload

  return hasChangePayload
    ? {
        access: 'extension',
        handle: ({ message }) => broadcastChangeEvent(message.payload),
      }
    : null
}

const MESSAGE_ROUTE_RESOLVERS: readonly RouteResolver[] = [
  resolveAuthRoute,
  resolveWalletRoute,
  resolveVaultRoute,
  resolveChangeRoute,
]

function resolveMessageRoute(message: BackgroundMessage): MessageRoute | null {
  for (const resolveRoute of MESSAGE_ROUTE_RESOLVERS) {
    const route = resolveRoute(message)
    if (route) return route
  }

  return null
}

export function handleMessage(
  message: BackgroundMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) {
  const route = resolveMessageRoute(message)

  if (!route) {
    log.warn('Unknown background message', message)
    return
  }

  if (!hasRequiredSender(sender, route.access)) {
    return rejectUnauthorized(message, sendResponse)
  }

  return route.handle({
    message,
    sender,
    sendResponse,
    tabId: sender.tab?.id,
  })
}
