import { Text } from '@evevault/shared/components'
import Json from '@evevault/shared/components/Json'
import type { PendingSponsoredTransaction } from '@evevault/shared/types'
import { createLogger, parseTransactionBytes } from '@evevault/shared/utils'
import { useWalletSigningContext } from '@evevault/shared/wallet'
import { usePendingSignAction } from '@/features/wallet/hooks'
import {
  requiresAcknowledgement,
  reviewTransaction,
} from '../transactionRiskReview'
import { SignRequestView } from './SignRequestView'
import { TransactionRiskPanel } from './TransactionRiskPanel'

const log = createLogger()

/**
 * Sponsored transaction with the backend-returned BCS bytes decoded for review.
 * The bytes shown here are the bytes signed (both derive from sponsoredTxB64),
 * so the user is no longer blind-signing the backend payload.
 */
type ParsedSponsoredTransaction = PendingSponsoredTransaction & {
  displayValue?: string
  reviewValue?: unknown
}

async function parsePendingSponsoredAction(
  pendingAction: unknown,
): Promise<ParsedSponsoredTransaction> {
  const action = pendingAction as Partial<PendingSponsoredTransaction>
  if (action.sponsoredTxB64 == null || action.preparationId == null) {
    throw new Error('No pending sponsored transaction found')
  }

  const parsed = await parseTransactionBytes(action.sponsoredTxB64)
  return {
    ...(pendingAction as PendingSponsoredTransaction),
    displayValue: parsed.displayValue,
    ...(parsed.reviewValue !== undefined && {
      reviewValue: parsed.reviewValue,
    }),
  }
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
    storeResult,
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

      const stored = await storeResult({
        status: 'signed',
        zkSignature,
        preparationId: pending.preparationId,
      })
      // A refused write (e.g. missing requestId) would strand the sponsored
      // request, so keep the popup open and surface the error instead of closing.
      if (!stored) {
        setError('Failed to record the signing result. Please try again.')
        return
      }
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

  const riskFindings = pending ? reviewTransaction(pending.reviewValue) : []

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
      requireAcknowledgement={requiresAcknowledgement(riskFindings)}
      onApprove={handleApprove}
      onReject={handleReject}
    >
      <div className="flex w-full flex-col items-center gap-2">
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

        <TransactionRiskPanel findings={riskFindings} />

        {pending?.displayValue && (
          <>
            <Text size="small" color="grey-neutral">
              Transaction payload
            </Text>
            <Json value={pending.displayValue} className="max-h-36 text-xs" />
          </>
        )}
      </div>
    </SignRequestView>
  )
}

export default SignSponsoredTransaction
