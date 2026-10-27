import type { DappRequestContext } from '@evevault/shared/types'
import { createLogger } from '@evevault/shared/utils'
import {
  sendToTab,
  type TabDocument,
} from '@/lib/background/messaging/tabMessaging'
import { sendAuthError } from './authHelpers'

const log = createLogger()

/** Delay in ms before retrying keeper unlock check (gives unlock time to complete) */
export const KEEPER_RETRY_DELAY_MS = 100

/** Time to wait for vault unlock before sending auth_error (2 minutes) */
export const PENDING_AUTH_TIMEOUT_MS = 2 * 60 * 1000

const UNLOCK_CANCELLED_MESSAGE = 'Vault unlock was cancelled or timed out.'
const REPLACED_MESSAGE = 'Replaced by a newer sign-in request.'

export interface PendingExtAuth {
  id: string
  type: 'ext'
  windowId?: number
  /** Tenant id for ext_login resume (popup context tenant when vault was locked). */
  tenantId?: string
}

export interface PendingDappAuth {
  id: string
  type: 'dapp'
  /** Page document that sent the connect; replies are only delivered to it. */
  target: TabDocument
  /** Request context captured from the original sender. */
  dappContext: DappRequestContext
  windowId?: number
  /** Extra connect request ids for same document (all get auth_success when unlock completes). */
  additionalIds: string[]
}

export type PendingAuthAfterUnlock = PendingExtAuth | PendingDappAuth

let pendingAuthAfterUnlock: PendingAuthAfterUnlock | null = null
let pendingAuthTimeoutId: ReturnType<typeof setTimeout> | null = null

export function clearPendingAuth(): void {
  if (pendingAuthTimeoutId !== null) {
    clearTimeout(pendingAuthTimeoutId)
    pendingAuthTimeoutId = null
  }
  pendingAuthAfterUnlock = null
}

export function sendPendingAuthError(
  pending: PendingAuthAfterUnlock,
  message = UNLOCK_CANCELLED_MESSAGE,
): void {
  const errorPayload = { message }
  if (pending.type === 'ext') {
    sendAuthError(pending.id, errorPayload)
  } else {
    for (const id of [pending.id, ...pending.additionalIds]) {
      sendToTab(pending.target, {
        id,
        type: 'auth_error',
        error: errorPayload,
      })
    }
  }
}

function startPendingTimeout(): void {
  if (pendingAuthTimeoutId !== null) clearTimeout(pendingAuthTimeoutId)
  pendingAuthTimeoutId = setTimeout(() => {
    pendingAuthTimeoutId = null
    const pending = pendingAuthAfterUnlock
    pendingAuthAfterUnlock = null
    if (pending) {
      sendPendingAuthError(pending)
    }
  }, PENDING_AUTH_TIMEOUT_MS)
}

/**
 * Adds a connect request id to the existing dapp pending for this tab and document.
 * If the tab now shows a different document, the pending is retargeted to this
 * request (keeping its popup window, restarting its timeout) and the earlier
 * ids get an auth_error at their own document.
 * @returns true if the id was added (no new popup should be opened)
 */
export function addPendingDappId(
  target: TabDocument,
  id: string,
  dappContext: DappRequestContext,
): boolean {
  const pending = pendingAuthAfterUnlock
  if (pending?.type !== 'dapp') return false
  if (pending.target.tabId !== target.tabId) return false
  if (pending.target.documentId !== target.documentId) {
    log.debug('Retargeting pending dapp connect to new tab document', {
      tabId: target.tabId,
    })
    const replaced = { ...pending }
    pendingAuthAfterUnlock = {
      ...pending,
      id,
      target,
      dappContext,
      additionalIds: [],
    }
    startPendingTimeout()
    sendPendingAuthError(replaced, REPLACED_MESSAGE)
    return true
  }
  // Deduplicate: only add if not already present
  if (pending.id !== id && !pending.additionalIds.includes(id)) {
    pending.additionalIds.push(id)
  }
  return true
}

/**
 * Stores the pending auth and starts its timeout. An existing entry is replaced
 * and its requests get an auth_error.
 */
export function setPendingAuthAfterUnlock(
  pending: PendingExtAuth | Omit<PendingDappAuth, 'additionalIds'>,
): void {
  const replaced = pendingAuthAfterUnlock
  clearPendingAuth()
  pendingAuthAfterUnlock =
    pending.type === 'dapp' ? { ...pending, additionalIds: [] } : { ...pending }
  startPendingTimeout()
  if (replaced) sendPendingAuthError(replaced, REPLACED_MESSAGE)
}

/**
 * Updates the popup window id for the dapp pending entry of this tab.
 * Used when pending state is created before opening the popup to avoid races.
 * Matches on tab rather than request id so a pending retargeted while the popup
 * was opening still gets its window.
 */
export function setPendingDappWindowId(tabId: number, windowId: number): void {
  const pending = pendingAuthAfterUnlock
  if (!pending) return

  // Guard against races: only update if the pending entry still belongs to the caller's tab.
  if (pending.type !== 'dapp' || pending.target.tabId !== tabId) {
    log.warn(
      'Ignoring windowId update for stale/mismatched pending auth entry',
      {
        tabId,
        pendingId: pending.id,
      },
    )
    return
  }

  // If a different windowId is already set, treat this as a race and ignore.
  if (pending.windowId !== undefined && pending.windowId !== windowId) {
    log.warn('Ignoring conflicting windowId update for pending auth entry', {
      pendingId: pending.id,
      existingWindowId: pending.windowId,
      newWindowId: windowId,
    })
    return
  }

  pending.windowId = windowId
}

/** Returns and clears the dapp pending entry for this tab, or null if there is none. */
export function takePendingDapp(tabId: number): PendingDappAuth | null {
  const pending = pendingAuthAfterUnlock
  if (pending?.type !== 'dapp' || pending.target.tabId !== tabId) return null
  clearPendingAuth()
  return pending
}

/** Returns the current pending auth without clearing (e.g. for window-close check). */
export function getPending(): PendingAuthAfterUnlock | null {
  return pendingAuthAfterUnlock
}

/**
 * Returns the current pending auth and clears it. Used by the coordinator to
 * resume the appropriate handler after unlock.
 */
export function getPendingAndClear(): PendingAuthAfterUnlock | null {
  const pending = pendingAuthAfterUnlock
  clearPendingAuth()
  return pending
}
