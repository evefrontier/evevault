import { WalletStandardMessageTypes } from '@evevault/shared'
import { getApiContext, getJwt, getStoredChain } from '@evevault/shared/auth'
import { createLogger } from '@evevault/shared/utils'
import { sendToTab } from '@/lib/background/messaging/tabMessaging'
import { requireDappPermission } from '@/lib/background/services/dappPermissions'
import { openPopupWindow } from '@/lib/background/services/popupWindow'
import type {
  EveFrontierSponsoredTransactionMessage,
  SponsoredTxReturn,
} from '@/lib/background/types'

const log = createLogger()

// Sends a sign_sponsored_transaction_error to the originating tab, or logs a
// warning if there's no tab to send to (e.g. request came from a background context).
function sendSponsoredError(
  senderTabId: number | undefined,
  messageId: string,
  error: string,
): void {
  if (senderTabId != null) {
    sendToTab(senderTabId, {
      type: 'sign_sponsored_transaction_error',
      error,
      id: messageId,
    })
  } else {
    log.warn('No sender tab id, cannot send error to page', { error })
  }
}

// Options for executeSponsoredTx — bundles the API context and the signed result
// so the function signature stays below qlty's parameter count threshold.
type ExecuteSponsoredTxOptions = {
  apiBaseUrl: string
  tenant: string
  idToken: string
  preparationId: string
  zkSignature: string
  senderTabId: number
  messageId: string
}

// POSTs the signed sponsored transaction to the backend execute endpoint and
// forwards the digest/effects back to the originating tab on success.
async function executeSponsoredTx({
  apiBaseUrl,
  tenant,
  idToken,
  preparationId,
  zkSignature,
  senderTabId,
  messageId,
}: ExecuteSponsoredTxOptions): Promise<void> {
  try {
    const response = await fetch(
      `${apiBaseUrl}/transactions/sponsored/execute`,
      {
        method: 'POST',
        body: JSON.stringify({
          preparationId,
          userSignatureB64Bytes: zkSignature,
        }),
        headers: {
          'X-Tenant': tenant,
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
      },
    )

    if (!response.ok) {
      throw new Error(
        `Sponsored execute failed: ${response.status} ${response.statusText}`,
      )
    }

    const result = (await response.json()) as {
      digest?: string
      effects?: string
    }
    sendToTab(senderTabId, {
      type: 'sign_success',
      digest: result.digest ?? '0x0',
      effects: result.effects ?? '0x0',
      id: messageId,
    })
  } catch (err) {
    log.error('Sponsored execute failed', err)
    sendToTab(senderTabId, {
      type: 'sign_sponsored_transaction_error',
      error: err instanceof Error ? err.message : 'Unknown error occurred',
      id: messageId,
    })
  }
}

async function handleSponsoredTransaction(
  message: EveFrontierSponsoredTransactionMessage,
  sender: chrome.runtime.MessageSender,
  _sendResponse: (response?: unknown) => void,
): Promise<boolean> {
  const senderTabId = sender.tab?.id
  const { action, assembly, assemblyType, metadata } = message.message

  try {
    const chain = await getStoredChain()
    const jwt = await getJwt()
    if (!jwt?.id_token) {
      sendSponsoredError(
        senderTabId,
        message.id,
        'No valid JWT found. Please re-authenticate.',
      )
      return true
    }

    if (assembly == null || !assemblyType) {
      throw new Error(`Assembly not found: ${assembly}, ${assemblyType}`)
    }

    const permission = await requireDappPermission(sender, chain)
    if (!permission.allowed) {
      sendSponsoredError(senderTabId, message.id, permission.error)
      return true
    }

    log.info('Eve Frontier sponsored transaction request received', {
      action,
      assembly,
      assemblyType,
      chain,
      metadata,
    })

    if (metadata) {
      log.info('Sponsored transaction metadata', {
        name: metadata?.name,
        description: metadata?.description,
        url: metadata?.url,
      })
    }

    const encodedAssemblyType = encodeURIComponent(assemblyType)
    const encodedAction = encodeURIComponent(action)
    const { apiBaseUrl, tenant } = getApiContext(jwt.id_token)

    const response = await fetch(
      `${apiBaseUrl}/transactions/sponsored/${encodedAssemblyType}/${encodedAction}`,
      {
        method: 'POST',
        body: JSON.stringify({
          assemblyId: assembly,
          name: metadata?.name,
          description: metadata?.description,
          url: metadata?.url,
        }),
        headers: {
          'X-Tenant': tenant,
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt.id_token}`,
        },
      },
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch txb: ${response.statusText}`)
    }

    const raw = await response.json()
    if (
      raw == null ||
      typeof raw !== 'object' ||
      typeof raw.bcsDataB64Bytes !== 'string' ||
      typeof raw.preparationId !== 'string'
    ) {
      throw new Error(
        'Sponsored tx API returned invalid shape: expected { bcsDataB64Bytes: string, preparationId: string }',
      )
    }
    const sponsoredTxReturn = raw as SponsoredTxReturn

    const actionType =
      WalletStandardMessageTypes.EVEFRONTIER_SIGN_SPONSORED_TRANSACTION
    const windowId = await openPopupWindow(actionType)

    if (!windowId) {
      throw new Error('Failed to open sponsored transaction popup')
    }

    await chrome.storage.local.set({
      pendingAction: {
        action: actionType,
        id: message.id,
        senderTabId,
        timestamp: Date.now(),
        windowId,
        sponsoredTxB64: sponsoredTxReturn.bcsDataB64Bytes,
        preparationId: sponsoredTxReturn.preparationId,
        chain,
        dapp: permission.context,
        sponsoredAction: action,
        assembly,
        assemblyType,
        metadata,
      },
    })

    let timeoutId: ReturnType<typeof setTimeout>
    let registeredListener: (changes: {
      [key: string]: chrome.storage.StorageChange
    }) => void

    const detachSponsoredListener = () => {
      clearTimeout(timeoutId)
      chrome.storage.onChanged.removeListener(registeredListener)
    }

    const coreListener = (changes: {
      [key: string]: chrome.storage.StorageChange
    }) => {
      const result = changes.transactionResult?.newValue
      if (!result || result.windowId !== windowId) return

      detachSponsoredListener()
      chrome.storage.local.remove(['pendingAction', 'transactionResult'])

      if (
        result.status === 'signed' &&
        result.zkSignature != null &&
        result.preparationId != null &&
        senderTabId != null
      ) {
        void executeSponsoredTx({
          apiBaseUrl,
          tenant,
          idToken: jwt.id_token,
          preparationId: result.preparationId,
          zkSignature: result.zkSignature,
          senderTabId,
          messageId: message.id,
        })
      } else if (result.status === 'error' && senderTabId != null) {
        sendSponsoredError(
          senderTabId,
          message.id,
          result.error ?? 'Transaction rejected or failed',
        )
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
        detachSponsoredListener()
        chrome.storage.local.remove(['pendingAction', 'transactionResult'])
        log.warn('Sponsored transaction approval timed out', { senderTabId })
      },
      10 * 60 * 1000,
    )

    chrome.storage.onChanged.addListener(registeredListener)

    return true
  } catch (error) {
    log.error('Transaction signing failed', error)
    sendSponsoredError(
      senderTabId,
      message.id,
      error instanceof Error ? error.message : 'Unknown error occurred',
    )
    return true
  }
}

export { handleSponsoredTransaction }
