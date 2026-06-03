import { Text } from '@evevault/shared/components'
import { createLogger } from '@evevault/shared/utils'
import { useWalletSigningContext } from '@evevault/shared/wallet'
import type { SuiChain } from '@mysten/wallet-standard'
import { usePendingSignAction } from '@/features/wallet/hooks'
import { SignRequestView } from './SignRequestView'

const log = createLogger()

export type PendingSponsoredAction = {
  action: string
  id?: string
  senderTabId?: number
  timestamp: number
  windowId: number
  sponsoredTxB64: string
  preparationId: string
  chain: SuiChain
}

function parsePendingSponsoredAction(
  pendingAction: unknown,
): PendingSponsoredAction {
  const action = pendingAction as Partial<PendingSponsoredAction>
  if (action.sponsoredTxB64 != null && action.preparationId != null) {
    return action as PendingSponsoredAction
  }

  throw new Error('No pending sponsored transaction found')
}

function getSponsoredApproveError(
  isLocalnet: boolean,
  auth: { user: unknown; ephemeralPublicKey: unknown; maxEpoch: unknown },
): string | null {
  if (isLocalnet) return 'Sponsored transactions are not available on localnet.'
  if (!auth.user) return 'Sign in and try again.'
  if (!auth.ephemeralPublicKey)
    return 'Device key not found. Unlock the wallet and try again.'
  if (!auth.maxEpoch) return 'Max epoch not set. Re-authenticate and try again.'
  return null
}

function SignSponsoredTransaction() {
  const { isLocalnet, sign } = useWalletSigningContext()
  const {
    pending,
    loading,
    setLoading,
    error,
    setError,
    auth,
    handleReject,
    storeErrorResult,
  } = usePendingSignAction({
    parsePending: parsePendingSponsoredAction,
    missingError: 'No pending sponsored transaction found',
    rejectError: 'Transaction rejected by user',
    rejectFailureError: 'Failed to reject transaction',
    rejectLogMessage: 'Failed to reject transaction',
    getWindowId: (pending) => pending.windowId,
  })

  const handleApprove = async () => {
    if (!pending) return
    const validationError = getSponsoredApproveError(isLocalnet, auth)
    if (validationError) {
      setError(validationError)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const txbBytes = Uint8Array.from(atob(pending.sponsoredTxB64), (c) =>
        c.charCodeAt(0),
      )
      const { signature: zkSignature } = await sign('TransactionData', txbBytes)

      await chrome.storage.local.set({
        transactionResult: {
          windowId: pending.windowId,
          status: 'signed',
          zkSignature,
          preparationId: pending.preparationId,
        },
      })
      window.close()
    } catch (err) {
      log.error('Sponsored transaction signing failed', err)
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      await storeErrorResult(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SignRequestView
      auth={auth}
      title="Approve sponsored transaction"
      hasPending={!!pending}
      loading={loading}
      error={error}
      loadingMessage="Loading..."
      chain={pending?.chain}
      onApprove={handleApprove}
      onReject={handleReject}
    >
      <Text>Sign this sponsored transaction to continue.</Text>
    </SignRequestView>
  )
}

export default SignSponsoredTransaction
