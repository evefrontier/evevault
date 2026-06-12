import { WalletStandardMessageTypes } from '@evevault/shared'
import { createLogger } from '@evevault/shared/utils'
import {
  type SigningErrorType,
  sendToTab,
} from '@/lib/background/messaging/tabMessaging'
import { openPopupWindow } from '@/lib/background/services/popupWindow'
import type { WalletActionMessage } from '@/lib/background/types'

const log = createLogger()

// Maps a wallet action string to its corresponding error message type so
// the dApp's listener can route the rejection correctly.
function getSignErrorType(action: string): SigningErrorType {
  if (action === WalletStandardMessageTypes.SIGN_TRANSACTION)
    return 'sign_transaction_error'
  if (action === WalletStandardMessageTypes.SIGN_PERSONAL_MESSAGE)
    return 'sign_personal_message_error'
  log.warn('Unknown action', { action })
  return 'sign_error'
}

// Sends the signed result back to the originating tab. Sign-and-execute has a
// richer payload and validates required fields before sending.
function sendApprovalSuccess(
  result: Record<string, unknown>,
  isSignAndExecute: boolean,
  senderTabId: number,
  messageId: string,
): void {
  if (isSignAndExecute) {
    const hasRequired =
      result.bytes != null &&
      result.signature != null &&
      result.digest != null &&
      result.effects != null
    if (!hasRequired) {
      sendToTab(senderTabId, {
        type: 'sign_and_execute_transaction_error',
        error: 'Missing bytes or signature in transaction result',
        id: messageId,
      })
    } else {
      sendToTab(senderTabId, {
        type: 'sign_and_execute_transaction_success',
        result: {
          bytes: result.bytes,
          signature: result.signature,
          digest: result.digest,
          effects: result.effects,
        },
        id: messageId,
      })
    }
  } else {
    sendToTab(senderTabId, {
      type: 'sign_success',
      bytes: result.bytes,
      signature: result.signature,
      id: messageId,
    })
  }
}

// Sends the appropriate error type to the originating tab. Sign-and-execute uses
// a dedicated error type; other actions derive their type from the action string.
function sendApprovalError(
  result: Record<string, unknown>,
  isSignAndExecute: boolean,
  senderTabId: number | undefined,
  action: string,
  messageId: string,
): void {
  if (isSignAndExecute && senderTabId) {
    sendToTab(senderTabId, {
      type: 'sign_and_execute_transaction_error',
      error: result.error,
      id: messageId,
    })
  } else if (typeof senderTabId === 'number') {
    const errorType = getSignErrorType(action)
    sendToTab(senderTabId, {
      type: errorType,
      error: result.error,
      id: messageId,
    })
  }
}

async function handleApprovePopup(
  message: WalletActionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): Promise<boolean> {
  const { action } = message

  try {
    log.info('Wallet action request received', { action: message.action })

    const senderTabId = sender.tab?.id
    const windowId = await openPopupWindow(action)

    if (!windowId) {
      throw new Error('Failed to open approval popup')
    }

    await chrome.storage.local.set({
      pendingAction: {
        ...message,
        windowId,
        senderTabId,
        timestamp: Date.now(),
      },
    })

    const isSignAndExecute =
      action === WalletStandardMessageTypes.SIGN_AND_EXECUTE_TRANSACTION

    let timeoutId: ReturnType<typeof setTimeout>
    let registeredListener: (changes: {
      [key: string]: chrome.storage.StorageChange
    }) => void

    const detachApprovalListener = () => {
      clearTimeout(timeoutId)
      chrome.storage.onChanged.removeListener(registeredListener)
    }

    const coreListener = (changes: {
      [key: string]: chrome.storage.StorageChange
    }) => {
      const result = changes.transactionResult?.newValue
      const isSuccess =
        result?.status === 'signed' || result?.status === 'signed_and_executed'

      if (isSuccess && senderTabId) {
        sendApprovalSuccess(result, isSignAndExecute, senderTabId, message.id)
        chrome.storage.local.remove(['pendingAction', 'transactionResult'])
        detachApprovalListener()
      } else if (result?.status === 'error') {
        sendApprovalError(
          result,
          isSignAndExecute,
          senderTabId,
          action,
          message.id,
        )
        chrome.storage.local.remove(['pendingAction', 'transactionResult'])
        detachApprovalListener()
      }
    }

    registeredListener = (changes: {
      [key: string]: chrome.storage.StorageChange
    }) => {
      clearTimeout(timeoutId)
      coreListener(changes)
    }

    timeoutId = setTimeout(
      () => {
        detachApprovalListener()
        chrome.storage.local.remove(['pendingAction', 'transactionResult'])
        log.warn('Transaction approval timed out', { action, senderTabId })
      },
      10 * 60 * 1000,
    )

    chrome.storage.onChanged.addListener(registeredListener)

    return true
  } catch (error) {
    log.error('Transaction signing failed', error)
    sendResponse({
      type: 'sign_transaction_error',
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    })
    return false
  }
}

export { handleApprovePopup }
