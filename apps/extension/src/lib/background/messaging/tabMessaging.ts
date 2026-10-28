import type { DappConnectSuccessMessage } from '@evevault/shared/types'
import {
  createLogger,
  hasNoTokenMaterial,
  type TokenMaterialField,
} from '@evevault/shared/utils'
import { browser } from 'wxt/browser'

const log = createLogger()

export const SIGNING_ERROR_TYPES = [
  'sign_error',
  'sign_transaction_error',
  'sign_personal_message_error',
  'sign_and_execute_transaction_error',
  'sign_sponsored_transaction_error',
] as const

export type SigningErrorType = (typeof SIGNING_ERROR_TYPES)[number]

/** Bare auth_success used by the web-unlock flow (no chain/address metadata). */
type WebUnlockSuccessMessage = { type: 'auth_success'; id: string }
type TabAuthErrorMessage = { type: 'auth_error'; id?: string; error?: unknown }
type SignSuccessMessage = {
  type: 'sign_success'
  id: string
  bytes?: string
  signature?: string
  digest?: string
  effects?: string
  executionStatus?: string
}
type SignAndExecuteSuccessMessage = {
  type: 'sign_and_execute_transaction_success'
  id: string
  result: {
    bytes: string
    signature: string
    digest: string
    effects: string
  }
}
type SigningErrorMessage = {
  type: SigningErrorType
  id: string
  error?: unknown
}
type DisconnectResponseMessage = {
  type: 'disconnect_success' | 'disconnect_error'
  id?: string
  error?: unknown
}
type ChangeEventMessage = {
  __from: 'Eve Vault'
  event: 'change'
  payload: unknown
}

/**
 * Every message shape that may legitimately be delivered to a web page/tab.
 * By construction none of these carry OAuth token material.
 */
export type TabBoundMessage =
  | DappConnectSuccessMessage
  | WebUnlockSuccessMessage
  | TabAuthErrorMessage
  | SignSuccessMessage
  | SignAndExecuteSuccessMessage
  | SigningErrorMessage
  | DisconnectResponseMessage
  | ChangeEventMessage

/** A page document in a tab. Messages sent to it are not delivered once the tab navigates away. */
export type TabDocument = { tabId: number; documentId: string }

/** Forbids any OAuth token field on a tab-bound message at compile time. */
type ForbidTokenMaterial = Partial<Record<TokenMaterialField, never>>

function inDevBuild(): boolean {
  try {
    return import.meta.env?.DEV === true
  } catch {
    return false
  }
}

/**
 * The ONLY permitted caller of chrome.tabs.sendMessage.
 *
 * chrome.tabs.sendMessage is the sole transport that reaches a content script
 * (and therefore a page). Funnelling every page-bound message through here
 * lets the TabBoundMessage type statically forbid OAuth token fields,
 * while the runtime hasNoTokenMaterial check is a second, independent guard
 * using the same predicate the content script applies on egress.
 *
 * Token material must only travel via chrome.runtime.sendMessage
 * (extension contexts) or live in chrome.storage.session / background memory.
 *
 * A TabDocument target delivers only to that document; a bare tab id delivers
 * to whatever page the tab shows when the message is sent.
 */
export function sendToTab<M extends TabBoundMessage>(
  target: number | TabDocument,
  message: M & ForbidTokenMaterial,
): void {
  if (!hasNoTokenMaterial(message)) {
    log.error('Blocked tab-bound message containing token material', {
      type: (message as { type?: unknown }).type,
    })
    if (inDevBuild()) {
      throw new Error('sendToTab: token material must never be sent to a tab')
    }
    return
  }

  const sent =
    typeof target === 'number'
      ? browser.tabs.sendMessage(target, message)
      : browser.tabs.sendMessage(target.tabId, message, {
          documentId: target.documentId,
        })
  void sent.catch((err: unknown) => {
    log.error('Failed to send message to tab', {
      tabId: typeof target === 'number' ? target : target.tabId,
      err,
    })
  })
}
