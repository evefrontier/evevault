import {
  PREDICTED_FAILURE_ACKNOWLEDGEMENT,
  requiresAcknowledgement,
  reviewTransaction,
} from '@evefrontier/wallet-core/transaction'
import { useRequireAlias } from '@evevault/shared'
import { KvRow } from '@evevault/shared/components'
import Json from '@evevault/shared/components/Json'
import type { PendingSponsoredTransaction } from '@evevault/shared/types'
import {
  b64ToBytesOrNull,
  createLogger,
  parseTransactionBytes,
} from '@evevault/shared/utils'
import { useWalletSigningContext } from '@evevault/shared/wallet'
import {
  usePendingSignAction,
  useTransactionSimulation,
} from '@/features/wallet/hooks'
import {
  ADDRESS_ALIAS_SIGNING_BLOCKED,
  transactionContainsAddressAliasCall,
} from '../aliasCallGuard'
import { type ApprovalTab, ApprovalTabs } from './ApprovalTabs'
import { SignRequestView } from './SignRequestView'
import { TransactionRiskPanel } from './TransactionRiskPanel'
import { TransactionSimulationPanel } from './TransactionSimulationPanel'

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

export async function parsePendingSponsoredAction(
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

export function getSponsoredApproveError(
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

// Decodes the backend payload once. `null` bytes means undecodable base64.
// Approve is blocked (with a warning) when the payload carries an alias call or
// can't be decoded.
function decodeSponsoredPayload(sponsoredTxB64: unknown): {
  bytes: Uint8Array | null
  blockReason: string | null
} {
  if (typeof sponsoredTxB64 !== 'string') {
    return { bytes: null, blockReason: null }
  }
  const bytes = b64ToBytesOrNull(sponsoredTxB64)
  const blocked = bytes === null || transactionContainsAddressAliasCall(bytes)
  return { bytes, blockReason: blocked ? ADDRESS_ALIAS_SIGNING_BLOCKED : null }
}

// Shown for an empty metadata field.
const CLEARED_VALUE = '(cleared)'

function SponsoredRequestDetails({
  pending,
}: {
  pending: ParsedSponsoredTransaction | null
}) {
  return (
    <div className="c-card">
      <span className="c-eyebrow">Sponsored request</span>
      <dl className="c-kv sign-view__context mt-3">
        <KvRow label="Action" value={pending?.sponsoredAction} />
        <KvRow label="Entity" value={pending?.entityId} />
        <KvRow
          label="Power"
          value={
            typeof pending?.on === 'boolean'
              ? pending.on
                ? 'On'
                : 'Off'
              : undefined
          }
        />
        {pending?.metadata && (
          <>
            <KvRow
              label="Name"
              value={pending.metadata.name || CLEARED_VALUE}
            />
            <KvRow
              label="Description"
              value={pending.metadata.description || CLEARED_VALUE}
            />
            <KvRow label="URL" value={pending.metadata.url || CLEARED_VALUE} />
          </>
        )}
      </dl>
    </div>
  )
}

function buildSponsoredTabs({
  simulation,
  senderAddress,
  riskFindings,
  needsRiskAck,
  displayValue,
}: {
  simulation: ReturnType<typeof useTransactionSimulation>
  senderAddress: string | undefined
  riskFindings: ReturnType<typeof reviewTransaction>
  needsRiskAck: boolean
  displayValue: string | undefined
}): ApprovalTab[] {
  return [
    {
      id: 'outcome',
      label: 'Outcome',
      content: (
        <TransactionSimulationPanel
          state={simulation}
          senderAddress={senderAddress}
          gasPaidBySponsor
        />
      ),
    },
    ...(riskFindings.length > 0
      ? [
          {
            id: 'warnings',
            label: `Warnings (${riskFindings.length})`,
            tone: needsRiskAck ? ('danger' as const) : ('warn' as const),
            content: <TransactionRiskPanel findings={riskFindings} />,
          },
        ]
      : []),
    ...(displayValue
      ? [
          {
            id: 'payload',
            label: 'Payload',
            content: <Json value={displayValue} className="max-h-52 text-xs" />,
          },
        ]
      : []),
  ]
}

function SignSponsoredTransaction() {
  const {
    isLocalnet,
    sign,
    suiClient,
    chain,
    getSenderAddress,
    senderAddress,
  } = useWalletSigningContext()
  const { ensureAlias, aliasSetupModal } = useRequireAlias()
  const {
    pending,
    loading,
    setLoading,
    error,
    setError,
    auth,
    handleReject,
    recoverIfLocked,
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

  const { bytes: sponsoredBytes, blockReason: aliasBlockReason } =
    decodeSponsoredPayload(pending?.sponsoredTxB64)

  const handleApprove = async () => {
    // Never sign an alias call, even if the disabled button is bypassed.
    // sponsoredBytes is only null when aliasBlockReason is set.
    if (!pending || aliasBlockReason || !sponsoredBytes) return
    const validationError = getSponsoredApproveError(isLocalnet, auth)
    if (validationError) {
      setError(validationError)
      return
    }

    if (!(await ensureAlias())) return

    try {
      setLoading(true)
      setError(null)

      const { signature: zkSignature } = await sign(
        'TransactionData',
        sponsoredBytes,
      )

      const stored = await storeResult({
        status: 'signed',
        zkSignature,
        preparationId: pending.preparationId,
      })
      // A refused write (e.g. missing requestId) would strand the sponsored
      // request, so keep the popup open and surface the error instead of closing.
      if (stored) {
        window.close()
      } else {
        setError('Failed to record the signing result. Please try again.')
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error occurred'
      if (!(await recoverIfLocked(errorMessage))) {
        log.error('Sponsored transaction signing failed', err)
        setError(errorMessage)
        await storeErrorResult(errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  const riskFindings = pending ? reviewTransaction(pending.reviewValue) : []

  // The sponsored bytes are already fully built (sender + sponsor gas), so
  // simulate them as-is rather than rebuilding, which would drop the sponsor.
  const simulation = useTransactionSimulation({
    payload: pending?.sponsoredTxB64 ?? null,
    mode: 'bytes',
    suiClient,
    chain,
    getSenderAddress,
    fallbackSender: senderAddress ?? undefined,
  })

  const predictedFailure =
    simulation?.status === 'ready' && simulation.simulation.status === 'failure'
  const needsRiskAck = requiresAcknowledgement(riskFindings)

  const tabs = buildSponsoredTabs({
    simulation,
    senderAddress: senderAddress ?? undefined,
    riskFindings,
    needsRiskAck,
    displayValue: pending?.displayValue,
  })

  return (
    <>
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
        requireAcknowledgement={needsRiskAck || predictedFailure}
        acknowledgementLabel={
          predictedFailure && !needsRiskAck
            ? PREDICTED_FAILURE_ACKNOWLEDGEMENT
            : undefined
        }
        approveBlockedReason={aliasBlockReason}
        onApprove={handleApprove}
        onReject={handleReject}
      >
        <div className="flex flex-col gap-3">
          <SponsoredRequestDetails pending={pending} />

          {pending && (
            <ApprovalTabs
              tabs={tabs}
              initialId={
                aliasBlockReason && riskFindings.length > 0
                  ? 'warnings'
                  : undefined
              }
            />
          )}
        </div>
      </SignRequestView>
      {aliasSetupModal}
    </>
  )
}

export default SignSponsoredTransaction
