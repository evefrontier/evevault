import { Text } from '@evevault/shared/components'
import type { PendingSponsoredTransaction } from '@evevault/shared/types'
import { createLogger } from '@evevault/shared/utils'
import { useWalletSigningContext } from '@evevault/shared/wallet'
import { usePendingSignAction } from '@/features/wallet/hooks'
import { SignRequestView } from './SignRequestView'

const log = createLogger()

function parsePendingSponsoredAction(
  pendingAction: unknown,
): PendingSponsoredTransaction {
  const action = pendingAction as Partial<PendingSponsoredTransaction>
  if (action.sponsoredTxB64 != null && action.preparationId != null) {
    return action as PendingSponsoredTransaction
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

function SponsoredDetail({
  label,
  value,
}: {
  label: string
  value: string | undefined
}) {
  if (!value) return null

  return (
    <div className="grid grid-cols-[82px_minmax(0,1fr)] gap-2 text-left">
      <span className="text-[10px] uppercase text-(--grey-neutral)">
        {label}
      </span>
      <span className="truncate text-xs text-(--neutral)" title={value}>
        {value}
      </span>
    </div>
  )
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
      dapp={pending?.dapp}
      requestKind="Sponsored transaction"
      onApprove={handleApprove}
      onReject={handleReject}
    >
      <div className="w-[320px] max-w-[88vw] border border-(--matter-05) p-3">
        <Text size="small" color="grey-neutral">
          Sponsored request
        </Text>
        <div className="mt-2 flex flex-col gap-2">
          <SponsoredDetail label="Action" value={pending?.sponsoredAction} />
          <SponsoredDetail
            label="Assembly"
            value={
              pending?.assembly != null ? String(pending.assembly) : undefined
            }
          />
          <SponsoredDetail label="Type" value={pending?.assemblyType} />
          <SponsoredDetail label="URL" value={pending?.metadata?.url} />
          <SponsoredDetail label="Name" value={pending?.metadata?.name} />
          <SponsoredDetail
            label="Description"
            value={pending?.metadata?.description}
          />
        </div>
      </div>
    </SignRequestView>
  )
}

export default SignSponsoredTransaction
