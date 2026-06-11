import { VaultMessageTypes, WalletStandardMessageTypes } from '@evevault/shared'
import { createLogger } from '@evevault/shared/utils'
import { sendToTab } from '@/lib/background/messaging/tabMessaging'
import {
  getDappRequestContext,
  revokeDappPermission,
} from '@/lib/background/services/dappPermissions'
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
type RouteField = 'action' | 'type'
type RouteAccess = 'dapp' | 'extension'
type RouteHandler = (
  m: BackgroundMessage,
  s: MsgSender,
  sr: SendResponse,
  tabId?: number,
) => unknown
type MessageRoute = {
  access: RouteAccess
  handle: RouteHandler
}
type DisconnectResponseMessage = {
  id?: string
  type: 'disconnect_success' | 'disconnect_error'
  error?: unknown
}

function routeKey(field: RouteField, value: string): string {
  return `${field}:${value}`
}

function runAsyncRoute(
  name: string,
  task: Promise<unknown>,
  onError?: (error: unknown) => void,
): true {
  void task.catch((error) => {
    log.error(`${name} failed`, error)
    onError?.(error)
  })
  return true
}

function sendDisconnectResponse(
  sender: MsgSender,
  sendResponse: SendResponse,
  response: DisconnectResponseMessage,
): void {
  sendResponse(response)

  const tabId = sender.tab?.id
  if (typeof tabId !== 'number') return

  sendToTab(tabId, response)
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error occurred'
}

async function handleDappDisconnect(
  message: BackgroundMessage,
  sender: MsgSender,
  sendResponse: SendResponse,
): Promise<void> {
  const result = await revokeDappPermission(sender)
  if (result.ok) {
    log.info('Revoked dApp permission', {
      origin: result.context.origin,
      hadPermission: result.hadPermission,
    })
    sendDisconnectResponse(sender, sendResponse, {
      id: message.id,
      type: 'disconnect_success',
    })
    return
  }

  sendDisconnectResponse(sender, sendResponse, {
    id: message.id,
    type: 'disconnect_error',
    error: { message: result.error },
  })
}

type VaultHandler = (m: VaultMessage, s: MsgSender, sr: SendResponse) => unknown
function vaultRoute(handler: VaultHandler): MessageRoute {
  return {
    access: 'extension',
    handle: (m, s, sr) =>
      runAsyncRoute(
        'vaultHandler',
        Promise.resolve(handler(m as VaultMessage, s, sr)),
      ),
  }
}

const MESSAGE_ROUTES: Record<string, MessageRoute> = {
  [routeKey('action', 'ext_login')]: {
    access: 'extension',
    handle: (m, s, sr) =>
      runAsyncRoute('handleExtLogin', handleExtLogin(m, s, sr)),
  },
  // Wallet Standard connect arrives as type='connect', not action='connect'.
  [routeKey('type', 'connect')]: {
    access: 'dapp',
    handle: (m, s, sr, tabId) =>
      runAsyncRoute('handleDappLogin', handleDappLogin(m, s, sr, tabId)),
  },
  [routeKey('type', WalletStandardMessageTypes.DISCONNECT)]: {
    access: 'dapp',
    handle: (m, s, sr) =>
      runAsyncRoute(
        'handleDappDisconnect',
        handleDappDisconnect(m, s, sr),
        (error) =>
          sendDisconnectResponse(s, sr, {
            id: m.id,
            type: 'disconnect_error',
            error: { message: getErrorMessage(error) },
          }),
      ),
  },
  [routeKey('action', 'web_unlock')]: {
    access: 'extension',
    handle: (m, s, sr) =>
      runAsyncRoute(
        'handleWebUnlock',
        handleWebUnlock(m as WebUnlockMessage, s, sr),
      ),
  },
  [routeKey('action', WalletStandardMessageTypes.SIGN_PERSONAL_MESSAGE)]: {
    access: 'dapp',
    handle: (m, s, sr) => handleApprovePopup(m as WalletActionMessage, s, sr),
  },
  [routeKey('action', WalletStandardMessageTypes.SIGN_TRANSACTION)]: {
    access: 'dapp',
    handle: (m, s, sr) => handleApprovePopup(m as WalletActionMessage, s, sr),
  },
  [routeKey('action', WalletStandardMessageTypes.SIGN_AND_EXECUTE_TRANSACTION)]:
    {
      access: 'dapp',
      handle: (m, s, sr) => handleApprovePopup(m as WalletActionMessage, s, sr),
    },
  [routeKey(
    'action',
    WalletStandardMessageTypes.EVEFRONTIER_SIGN_SPONSORED_TRANSACTION,
  )]: {
    access: 'dapp',
    handle: (m, s, sr) =>
      handleSponsoredTransaction(
        m as EveFrontierSponsoredTransactionMessage,
        s,
        sr,
      ),
  },
  [routeKey('type', VaultMessageTypes.UNLOCK_VAULT)]:
    vaultRoute(handleUnlockVault),
  [routeKey('type', VaultMessageTypes.LOCK)]: vaultRoute(handleLock),
  [routeKey('type', VaultMessageTypes.CREATE_KEYPAIR)]:
    vaultRoute(_handleCreateKeypair),
  [routeKey('type', VaultMessageTypes.ROTATE_KEYPAIR)]:
    vaultRoute(_handleRotateKeypair),
  [routeKey('type', VaultMessageTypes.GET_PUBLIC_KEY)]:
    vaultRoute(_handleGetPublicKey),
  [routeKey('type', VaultMessageTypes.ZK_EPH_SIGN_BYTES)]: vaultRoute(
    _handleZkEphSignBytes,
  ),
  [routeKey('type', VaultMessageTypes.SET_ZKPROOF)]:
    vaultRoute(_handleSetZkProof),
  [routeKey('type', VaultMessageTypes.GET_ZKPROOF)]:
    vaultRoute(_handleGetZkProof),
  [routeKey('type', VaultMessageTypes.CLEAR_ZKPROOF)]:
    vaultRoute(_handleClearZkProof),
  [routeKey('type', VaultMessageTypes.LOCALNET_SET_KEYPAIR)]: vaultRoute(
    _handleLocalnetSetKeypair,
  ),
  [routeKey('type', VaultMessageTypes.LOCALNET_GET_ADDRESS)]: vaultRoute(
    _handleLocalnetGetAddress,
  ),
  [routeKey('type', VaultMessageTypes.LOCALNET_SIGN_BYTES)]: vaultRoute(
    _handleLocalnetSignBytes,
  ),
}

function findRoute(message: BackgroundMessage): MessageRoute | undefined {
  const candidates: Array<[RouteField, unknown]> = [
    ['action', message.action],
    ['type', message.type],
  ]

  for (const [field, value] of candidates) {
    if (typeof value !== 'string') continue
    const route = MESSAGE_ROUTES[routeKey(field, value)]
    if (route) return route
  }

  return undefined
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
  return (
    typeof sender.tab?.id === 'number' && getDappRequestContext(sender) !== null
  )
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

function hasRequiredSender(sender: MsgSender, access: RouteAccess): boolean {
  return access === 'extension'
    ? isExtensionSender(sender)
    : isDappSender(sender)
}

function broadcastChangeEvent(payload: unknown): void {
  log.info('Broadcasting chain change event', payload)
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id) {
        sendToTab(tab.id, {
          __from: 'Eve Vault',
          event: 'change',
          payload,
        })
      }
    })
  })
}

export function handleMessage(
  message: BackgroundMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) {
  const route = findRoute(message)
  if (route) {
    if (!hasRequiredSender(sender, route.access)) {
      return rejectUnauthorized(message, sendResponse)
    }
    return route.handle(message, sender, sendResponse, sender.tab?.id)
  }

  if (message.event === 'change' && message.payload) {
    if (!hasRequiredSender(sender, 'extension')) {
      return rejectUnauthorized(message, sendResponse)
    }
    broadcastChangeEvent(message.payload)
    return true
  }

  log.warn('Unknown background message', message)
}
