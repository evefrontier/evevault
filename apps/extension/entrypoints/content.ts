import { WalletStandardMessageTypes } from '@evevault/shared/types'
import { createLogger } from '@evevault/shared/utils'
import { CONTEXT_STORAGE_KEY } from '@evevault/shared/utils/storageKeys'

const log = createLogger()
const PUBLIC_WALLET_ACTIONS = new Set<string>([
  WalletStandardMessageTypes.SIGN_PERSONAL_MESSAGE,
  WalletStandardMessageTypes.SIGN_TRANSACTION,
  WalletStandardMessageTypes.SIGN_AND_EXECUTE_TRANSACTION,
  WalletStandardMessageTypes.EVEFRONTIER_SIGN_SPONSORED_TRANSACTION,
])
const SPONSORED_MESSAGE_STRING_FIELDS = [
  'action',
  'assembly',
  'assemblyType',
] as const

type PageMessageValidator = (data: Record<string, unknown>) => boolean

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

function isValidRequestId(value: unknown): value is string {
  if (typeof value !== 'string') return false

  return every([value.length > 0, value.length <= 128])
}

function getPageTargetOrigin(): string | null {
  const origin = window.location.origin
  return origin && origin !== 'null' ? origin : null
}

function isTrustedPageEvent(event: MessageEvent): boolean {
  const origin = getPageTargetOrigin()

  return every([event.source === window, !!origin, event.origin === origin])
}

function hasObjectAccount(data: Record<string, unknown>): boolean {
  return isRecord(data.account)
}

function every(checks: boolean[]): boolean {
  return checks.every(Boolean)
}

function hasStringFields(
  data: Record<string, unknown>,
  fields: readonly string[],
): boolean {
  return fields.every((field) => typeof data[field] === 'string')
}

function hasOptionalObjectMetadata(data: Record<string, unknown>): boolean {
  return data.metadata === undefined || isRecord(data.metadata)
}

function isEveVaultRequest(data: unknown): data is Record<string, unknown> {
  return isRecord(data) && data.__to === 'Eve Vault'
}

function isConnectMessage(data: Record<string, unknown>): boolean {
  return data.type === 'connect' && isValidRequestId(data.id)
}

function isPersonalMessageRequest(data: Record<string, unknown>): boolean {
  return every([
    isValidRequestId(data.id),
    data.message !== undefined,
    hasObjectAccount(data),
  ])
}

function isTransactionRequest(data: Record<string, unknown>): boolean {
  return every([
    isValidRequestId(data.id),
    typeof data.transaction === 'string',
    hasObjectAccount(data),
  ])
}

function isSponsoredTransactionRequest(data: Record<string, unknown>): boolean {
  const message = data.message
  if (!isRecord(message)) return false

  return every([
    isValidRequestId(data.id),
    hasStringFields(message, SPONSORED_MESSAGE_STRING_FIELDS),
    hasOptionalObjectMetadata(message),
  ])
}

const WALLET_ACTION_VALIDATORS: Partial<Record<string, PageMessageValidator>> =
  {
    [WalletStandardMessageTypes.SIGN_PERSONAL_MESSAGE]:
      isPersonalMessageRequest,
    [WalletStandardMessageTypes.SIGN_TRANSACTION]: isTransactionRequest,
    [WalletStandardMessageTypes.SIGN_AND_EXECUTE_TRANSACTION]:
      isTransactionRequest,
    [WalletStandardMessageTypes.EVEFRONTIER_SIGN_SPONSORED_TRANSACTION]:
      isSponsoredTransactionRequest,
  }

function isAllowedWalletAction(data: Record<string, unknown>): boolean {
  const action = typeof data.action === 'string' ? data.action : ''
  const validator = WALLET_ACTION_VALIDATORS[action]

  return PUBLIC_WALLET_ACTIONS.has(action) && !!validator?.(data)
}

function isAllowedBridgePayload(data: Record<string, unknown>): boolean {
  return data.type === 'connect'
    ? isConnectMessage(data)
    : isAllowedWalletAction(data)
}

export function isAllowedPageMessage(
  data: unknown,
): data is Record<string, unknown> {
  if (!isEveVaultRequest(data)) return false

  return isAllowedBridgePayload(data)
}

function postToPage(message: Record<string, unknown>): void {
  const targetOrigin = getPageTargetOrigin()
  if (!targetOrigin) return
  window.postMessage(message, targetOrigin)
}

function resolveCurrentChain(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.local.get([CONTEXT_STORAGE_KEY], (result) => {
      let chain = 'sui:testnet'
      try {
        const stored = result[CONTEXT_STORAGE_KEY]
        if (stored) {
          const parsed =
            typeof stored === 'string' ? JSON.parse(stored) : stored
          if (parsed?.state?.chain) chain = parsed.state.chain
        }
      } catch {
        // fall back to testnet
      }
      resolve(chain)
    })
  })
}

async function handleGetCurrentChain() {
  const chain = await resolveCurrentChain()
  postToPage({
    __from: 'Eve Vault',
    event: 'change',
    payload: { chains: [chain] },
  })
}

export function handleWindowMessage(event: MessageEvent) {
  if (!isTrustedPageEvent(event)) return

  const data = (event.data || {}) as Record<string, unknown>
  if (data.__from === 'Eve Vault') return

  if (data.__to === 'Eve Vault' && data.type === 'get_current_chain') {
    void handleGetCurrentChain()
    return
  }

  if (isAllowedPageMessage(data)) {
    chrome.runtime.sendMessage(data)
  }
}

export function forwardToPage(message: Record<string, unknown>) {
  const id = (message.id as string) || undefined
  const type = (message.type as string) || ''
  postToPage({ __from: 'Eve Vault', id, type, ...message })
}

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  main() {
    log.info('Eve Vault content script loaded')

    const injectScript = document.createElement('script')
    injectScript.src = chrome.runtime.getURL('injected.js')
    ;(document.head || document.documentElement).appendChild(injectScript)

    window.addEventListener('message', handleWindowMessage)
    chrome.runtime.onMessage.addListener(forwardToPage)
  },
})
