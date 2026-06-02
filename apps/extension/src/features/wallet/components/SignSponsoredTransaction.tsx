import { Text } from '@evevault/shared/components'
import { createLogger } from '@evevault/shared/utils'
import { useWalletSigningContext } from '@evevault/shared/wallet'
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
  chain: string
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
    if (isLocalnet) {
      setError('Sponsored transactions are not available on localnet.')
      return
    }
    if (!auth.user) {
      setError('Sign in and try again.')
      return
    }
    if (!auth.ephemeralPublicKey) {
      setError('Device key not found. Unlock the wallet and try again.')
      return
    }
    if (!auth.maxEpoch) {
      setError('Max epoch not set. Re-authenticate and try again.')
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
