import { createLogger } from '@evevault/shared/utils'
import { type Browser, browser } from 'wxt/browser'
import type { MessageWithId } from '@/lib/background/types'
import { connectDapp, handleDappLogin } from './auth/dappLogin'
import { handleExtLogin } from './auth/extLogin'
import {
  clearPendingAuth,
  getPending,
  getPendingAndClear,
  sendPendingAuthError,
  takePendingDapp,
} from './auth/pendingAuth'
import { handleWebUnlock } from './auth/webUnlock'

const log = createLogger()

if (browser?.windows?.onRemoved) {
  browser.windows.onRemoved.addListener((removedWindowId) => {
    const pending = getPending()
    if (pending?.windowId === removedWindowId) {
      clearPendingAuth()
      sendPendingAuthError(pending)
    }
  })
}

if (browser?.tabs?.onRemoved) {
  browser.tabs.onRemoved.addListener((removedTabId) => {
    if (takePendingDapp(removedTabId)) {
      log.debug('Dropped pending dapp login for closed tab', {
        tabId: removedTabId,
      })
    }
  })
}

export function checkPendingAuthAfterUnlock(): void {
  const pending = getPendingAndClear()
  if (!pending) return
  if (pending.type === 'ext') {
    handleExtLogin(
      {
        action: 'ext_login',
        id: pending.id,
        ...(pending.tenantId && { tenantId: pending.tenantId }),
      } as MessageWithId,
      undefined as unknown as Browser.runtime.MessageSender,
      () => {},
    ).catch((error) => {
      log.error('Failed to resume extension login after unlock', error)
    })
  } else {
    // Replies go only to the document captured when the connect was made.
    connectDapp(pending).catch((error) => {
      log.error('Failed to resume dapp login after unlock', error)
    })
  }
}

export { handleDappLogin, handleExtLogin, handleWebUnlock }
