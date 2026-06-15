import { WalletStandardMessageTypes } from '@evevault/shared/types'
import { createLogger, hasNoTokenMaterial } from '@evevault/shared/utils'
import { CONTEXT_STORAGE_KEY } from '@evevault/shared/utils/storageKeys'

const log = createLogger()
const PUBLIC_WALLET_ACTIONS = new Set<string>([
  WalletStandardMessageTypes.SIGN_PERSONAL_MESSAGE,
  WalletStandardMessageTypes.SIGN_TRANSACTION,
  WalletStandardMessageTypes.SIGN_AND_EXECUTE_TRANSACTION,
  WalletStandardMessageTypes.EVEFRONTIER_SIGN_SPONSORED_TRANSACTION,
])
const SPONSORED_MESSAGE_STRING_FIELDS = ['action', 'assemblyType'] as const

type PageMessageValidator = (data: Record<string, unknown>) => boolean

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function every(checks: boolean[]): boolean {
  return checks.every(Boolean)
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
    Number.isFinite(message.assembly),
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

function hasStringIdAndType(data: Record<string, unknown>): boolean {
  return isValidRequestId(data.id) && typeof data.type === 'string'
}

function isPublicAuthSuccess(data: Record<string, unknown>): boolean {
  return every([
    hasStringIdAndType(data),
    data.type === 'auth_success',
    // chain/address are present on dApp connect success but absent on the bare
    // web-unlock auth_success ({ id, type }); both are valid, token-free shapes.
    data.chain === undefined || typeof data.chain === 'string',
    data.address === undefined || typeof data.address === 'string',
    data.publicKey === undefined || typeof data.publicKey === 'string',
  ])
}

function isPublicAuthError(data: Record<string, unknown>): boolean {
  return every([
    hasStringIdAndType(data),
    data.type === 'auth_error',
    data.error !== undefined,
  ])
}

function isSignatureSuccess(data: Record<string, unknown>): boolean {
  return every([
    hasStringIdAndType(data),
    data.type === 'sign_success',
    typeof data.bytes === 'string' || typeof data.digest === 'string',
    typeof data.signature === 'string' || typeof data.effects === 'string',
  ])
}

function isSignAndExecuteSuccess(data: Record<string, unknown>): boolean {
  return every([
    hasStringIdAndType(data),
    data.type === 'sign_and_execute_transaction_success',
    isRecord(data.result),
  ])
}

const PUBLIC_ERROR_TYPES = new Set([
  'sign_error',
  'sign_personal_message_error',
  'sign_transaction_error',
  'sign_and_execute_transaction_error',
  'sign_sponsored_transaction_error',
])

function isPublicErrorType(value: unknown): value is string {
  return typeof value === 'string' && PUBLIC_ERROR_TYPES.has(value)
}

function isPublicSigningError(data: Record<string, unknown>): boolean {
  return every([
    hasStringIdAndType(data),
    isPublicErrorType(data.type),
    data.error !== undefined,
  ])
}

function isPublicChangeEvent(data: Record<string, unknown>): boolean {
  return data.event === 'change' && isRecord(data.payload)
}

const PUBLIC_EXTENSION_MESSAGE_VALIDATORS: readonly PageMessageValidator[] = [
  isPublicAuthSuccess,
  isPublicAuthError,
  isSignatureSuccess,
  isSignAndExecuteSuccess,
  isPublicSigningError,
  isPublicChangeEvent,
]

export function isAllowedExtensionMessage(
  data: unknown,
): data is Record<string, unknown> {
  if (!isRecord(data) || !hasNoTokenMaterial(data)) return false

  return PUBLIC_EXTENSION_MESSAGE_VALIDATORS.some((validator) =>
    validator(data),
  )
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
  if (!isAllowedExtensionMessage(message)) return

  const id = (message.id as string) || undefined
  const type = (message.type as string) || ''
  // Spread first so the forwarded message can never override the authenticity
  // marker (__from) or the normalized id/type the page relies on.
  postToPage({ ...message, __from: 'Eve Vault', id, type })
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
