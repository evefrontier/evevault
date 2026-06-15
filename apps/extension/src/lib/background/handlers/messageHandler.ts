import { VaultMessageTypes, WalletStandardMessageTypes } from '@evevault/shared'
import { createLogger, redactSensitive } from '@evevault/shared/utils'
import { sendToTab } from '@/lib/background/messaging/tabMessaging'
import { revokeDappPermission } from '@/lib/background/services/dappPermissions'
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
type VaultHandler = (m: VaultMessage, s: MsgSender, sr: SendResponse) => unknown
type MessageRoute = {
  access: RouteAccess
  handle: RouteHandler
}
type DisconnectResponseMessage = {
  id?: string
  type: 'disconnect_success' | 'disconnect_error'
  error?: unknown
}

/**
 * Builds the normalized lookup key used by MESSAGE_ROUTES for fields that can
 * route a message. Keeping the field in the key avoids collisions between
 * identical action and type values.
 */
function routeKey(field: RouteField, value: string): string {
  return `${field}:${value}`
}

/**
 * Starts an async route without blocking Chrome's message listener and keeps
 * the channel open by returning true. Route-specific error handling can attach
 * a fallback response through onError.
 */
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

/**
 * Sends a disconnect result through the immediate runtime response and, when
 * the request came from a tab, mirrors it back through the content-script path.
 */
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

/**
 * Converts unexpected route failures into a stable message for dApp-facing
 * disconnect errors.
 */
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error occurred'
}

/**
 * Revokes the stored permission for the sender's dApp origin and reports the
 * disconnect outcome using the Wallet Standard response shape.
 */
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

/**
 * Adapts vault-only handlers into MessageRoute entries that are restricted to
 * extension senders and run through the shared async route wrapper.
 */
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
      runAsyncRoute(
        'handleSponsoredTransaction',
        handleSponsoredTransaction(
          m as EveFrontierSponsoredTransactionMessage,
          s,
          sr,
        ),
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

/**
 * Finds the first route registered for the message's action or type field.
 * Action is checked first because Wallet Standard signing requests route by
 * action, while connect/disconnect and vault messages route by type.
 */
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

/**
 * Identifies messages that originate from this extension rather than a web
 * page. Runtime messages without tab/origin/url metadata are also treated as
 * internal extension messages.
 */
function isExtensionSender(sender: MsgSender): boolean {
  const senderUrls = [sender.origin, sender.url, sender.tab?.url]
  const extensionId = chrome.runtime?.id
  const isOwnExtensionUrl = (url: string | undefined) => {
    if (!url) return false
    if (!extensionId) return url.startsWith('chrome-extension://')

    return url.startsWith(`chrome-extension://${extensionId}/`)
  }

  if (senderUrls.some(isOwnExtensionUrl)) return true

  return !sender.tab && !sender.origin && !sender.url
}

/**
 * Identifies messages sent by a page tab, excluding extension UI tabs so
 * extension pages cannot exercise dApp-only routes.
 */
function isDappSender(sender: MsgSender): boolean {
  return typeof sender.tab?.id === 'number' && !isExtensionSender(sender)
}

/**
 * Emits a consistent authorization failure for routes called from the wrong
 * sender class and logs only routing metadata.
 */
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

/**
 * Checks whether a sender is allowed to call a route based on the route's
 * declared access policy.
 */
function hasRequiredSender(sender: MsgSender, access: RouteAccess): boolean {
  return access === 'extension'
    ? isExtensionSender(sender)
    : isDappSender(sender)
}

/**
 * Broadcasts extension-originated account/chain change events to all tabs via
 * the guarded tab messaging path.
 */
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

  log.warn('Unknown background message', redactSensitive(message))
}
