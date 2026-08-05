import {
  executeSponsoredTransaction,
  fetchUnsignedSponsoredTransaction,
  type SponsoredTransactionApiContext,
} from '@evefrontier/wallet-core/sponsored-transaction'
import {
  type PendingSponsoredTransaction,
  WalletActions,
  WalletStandardMessageTypes,
} from '@evevault/shared'
import { getApiContext, getJwt, getStoredChain } from '@evevault/shared/auth'
import { createLogger } from '@evevault/shared/utils'
import { sendToTab } from '@/lib/background/messaging/tabMessaging'
import { openPopupWindow } from '@/lib/background/services/popupWindow'
import type { EveFrontierSponsoredTransactionMessage } from '@/lib/background/types'
import { requireSigningPermission } from './signingPermissions'

const log = createLogger()

// Builds the wallet-core API context. `pathPrefix` accounts for the prepare
// endpoint living under /v2 while execute sits at the gateway root.
function sponsoredApiContext(
  apiBaseUrl: string,
  tenant: string,
  idToken: string,
  pathPrefix = '',
): SponsoredTransactionApiContext {
  return {
    getApiGatewayUrl: (path) => `${apiBaseUrl}${pathPrefix}/${path}`,
    getApiGatewayToken: () => idToken,
    tenant,
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
    const { digest, effects } = await executeSponsoredTransaction(
      { preparationId, userSignatureB64Bytes: zkSignature },
      sponsoredApiContext(apiBaseUrl, tenant, idToken),
    )
    sendToTab(senderTabId, {
      type: 'sign_success',
      digest,
      effects,
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

    const permission = await requireSigningPermission(sender, chain)
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

    const { apiBaseUrl, tenant } = getApiContext(jwt.id_token)

    const sponsoredTxReturn = await fetchUnsignedSponsoredTransaction(
      {
        txAction: action,
        // repo forwards assemblyId as a string; wallet-core types it as number
        assembly: assembly as unknown as number,
        assemblyType,
        metadata,
      },
      sponsoredApiContext(apiBaseUrl, tenant, jwt.id_token, '/v2'),
    )

    const actionType =
      WalletStandardMessageTypes.EVEFRONTIER_SIGN_SPONSORED_TRANSACTION
    const windowId = await openPopupWindow(actionType)

    if (!windowId) {
      throw new Error('Failed to open sponsored transaction popup')
    }

    const requestId = crypto.randomUUID()

    const pendingAction: PendingSponsoredTransaction = {
      action: WalletActions.SIGN_SPONSORED_TRANSACTION,
      id: message.id,
      senderTabId,
      timestamp: Date.now(),
      windowId,
      requestId,
      sponsoredTxB64: sponsoredTxReturn.bcsDataB64Bytes,
      preparationId: sponsoredTxReturn.preparationId,
      chain,
      dapp: permission.context,
      sponsoredAction: action,
      assembly,
      assemblyType,
      metadata,
    }

    await chrome.storage.local.set({ pendingAction })

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
      if (
        !result ||
        result.windowId !== windowId ||
        result.requestId !== requestId
      )
        return

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
