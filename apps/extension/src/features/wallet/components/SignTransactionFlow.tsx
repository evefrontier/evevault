import {
  PREDICTED_FAILURE_ACKNOWLEDGEMENT,
  requiresAcknowledgement,
  reviewTransaction,
} from '@evefrontier/wallet-core/transaction'
import { useRequireAlias } from '@evevault/shared'
import Json from '@evevault/shared/components/Json'
import { useWalletSigningContext } from '@evevault/shared/wallet'
import {
  useTransactionSigning,
  useTransactionSimulation,
} from '@/features/wallet/hooks'
import type {
  SignResult,
  StoreResult,
} from '@/features/wallet/hooks/useTransactionSigning'
import {
  ADDRESS_ALIAS_SIGNING_BLOCKED,
  transactionContainsAddressAliasCall,
} from '../aliasCallGuard'
import { type ApprovalTab, ApprovalTabs } from './ApprovalTabs'
import { SignRequestView } from './SignRequestView'
import { TransactionRiskPanel } from './TransactionRiskPanel'
import { TransactionSimulationPanel } from './TransactionSimulationPanel'

interface SignTransactionFlowProps {
  title: string
  onSign: (result: SignResult, storeResult: StoreResult) => Promise<void>
}

export function SignTransactionFlow({
  title,
  onSign,
}: SignTransactionFlowProps) {
  const { suiClient, chain, getSenderAddress, senderAddress } =
    useWalletSigningContext()
  const {
    pendingTransaction,
    loading,
    error,
    auth,
    handleReject,
    withSigning,
    storeResult,
  } = useTransactionSigning()

  const simulation = useTransactionSimulation({
    payload: pendingTransaction?.transaction ?? null,
    mode: 'build',
    suiClient,
    chain,
    getSenderAddress,
    fallbackSender: pendingTransaction?.account?.address,
  })

  const { ensureAlias, aliasSetupModal } = useRequireAlias()

  // Block Approve (with a warning) when the request carries an alias call.
  const aliasBlockReason =
    typeof pendingTransaction?.transaction === 'string' &&
    transactionContainsAddressAliasCall(pendingTransaction.transaction)
      ? ADDRESS_ALIAS_SIGNING_BLOCKED
      : null

  const handleApprove = async () => {
    // Never sign an alias call.
    if (aliasBlockReason) return
    if (!(await ensureAlias())) return
    await withSigning((result) => onSign(result, storeResult))
  }

  const riskFindings = pendingTransaction
    ? reviewTransaction(pendingTransaction.reviewValue)
    : []

  // A simulated on-chain failure is a danger signal in its own right, so gate
  // approval behind the acknowledgement even when the static review is clean.
  const predictedFailure =
    simulation?.status === 'ready' && simulation.simulation.status === 'failure'
  const needsRiskAck = requiresAcknowledgement(riskFindings)

  const tabs: ApprovalTab[] = pendingTransaction
    ? [
        {
          id: 'outcome',
          label: 'Outcome',
          content: (
            <TransactionSimulationPanel
              state={simulation}
              senderAddress={
                senderAddress ?? pendingTransaction.account?.address
              }
            />
          ),
        },
        ...(riskFindings.length > 0
          ? [
              {
                id: 'warnings',
                label: `Warnings (${riskFindings.length})`,
                tone: needsRiskAck ? ('danger' as const) : ('default' as const),
                content: <TransactionRiskPanel findings={riskFindings} />,
              },
            ]
          : []),
        {
          id: 'payload',
          label: 'Payload',
          content: (
            <Json
              value={pendingTransaction.displayValue}
              className="max-h-52 text-xs"
            />
          ),
        },
      ]
    : []

  return (
    <>
      <SignRequestView
        auth={auth}
        title={title}
        hasPending={!!pendingTransaction}
        loading={loading}
        error={error}
        approveBlockedReason={aliasBlockReason}
        loadingMessage="Loading transaction..."
        chain={pendingTransaction?.chain}
        dapp={pendingTransaction?.dapp}
        accountAddress={senderAddress ?? pendingTransaction?.account?.address}
        requestKind={title}
        requireAcknowledgement={needsRiskAck || predictedFailure}
        acknowledgementLabel={
          predictedFailure && !needsRiskAck
            ? PREDICTED_FAILURE_ACKNOWLEDGEMENT
            : undefined
        }
        onApprove={handleApprove}
        onReject={handleReject}
      >
        {pendingTransaction && (
          <div className="flex w-full flex-col items-center gap-2">
            <ApprovalTabs
              tabs={tabs}
              initialId={
                aliasBlockReason && riskFindings.length > 0
                  ? 'warnings'
                  : undefined
              }
            />
          </div>
        )}
      </SignRequestView>
      {aliasSetupModal}
    </>
  )
}
