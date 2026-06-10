import { storeJwt } from '@evevault/shared'
import { createLogger } from '@evevault/shared/utils'
import type { WebUnlockMessage } from '@/lib/background/types'
import { ensureMessageId } from './authHelpers'

const log = createLogger()

export async function handleWebUnlock(
  message: WebUnlockMessage,
  _sender: chrome.runtime.MessageSender,
  _sendResponse: (response?: unknown) => void,
): Promise<void> {
  log.info('Evefrontier web unlock request')

  const id = ensureMessageId(message)

  try {
    const { jwt, tabId } = message

    await storeJwt(jwt)

    if (typeof tabId === 'number') {
      chrome.tabs.sendMessage(tabId, {
        id,
        type: 'auth_success',
      })
    }
  } catch (error) {
    const tabId = typeof message.tabId === 'number' ? message.tabId : null

    const errorMessage =
      error instanceof Error ? error.message : 'Failed to complete web unlock'
    log.error('Web unlock failed', { error })
    if (tabId !== null) {
      chrome.tabs.sendMessage(tabId, {
        id,
        type: 'auth_error',
        error: errorMessage,
      })
    }
  }
}
