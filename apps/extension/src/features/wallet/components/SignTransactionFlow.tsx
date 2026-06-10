import { Text } from '@evevault/shared/components'
import Json from '@evevault/shared/components/Json'
import { useTransactionSigning } from '@/features/wallet/hooks'
import type { SignResult } from '@/features/wallet/hooks/useTransactionSigning'
import {
  reviewTransactionDisplay,
  type TransactionRiskFinding,
} from '../transactionRiskReview'
import { SignRequestView } from './SignRequestView'

interface SignTransactionFlowProps {
  title: string
  onSign: (result: SignResult) => Promise<void>
}

function TransactionRiskPanel({
  findings,
}: {
  findings: TransactionRiskFinding[]
}) {
  if (findings.length === 0) return null

  return (
    <div className="w-[80vw] max-h-32 overflow-y-auto border border-[var(--matter-05)] p-2 text-left">
      <Text size="small" color="grey-neutral">
        Transaction warnings
      </Text>
      <div className="mt-2 flex flex-col gap-2">
        {findings.map((finding) => (
          <div key={`${finding.severity}:${finding.title}`}>
            <Text
              size="small"
              variant="bold"
              color={finding.severity === 'danger' ? 'error' : 'neutral'}
            >
              {finding.title}
            </Text>
            <Text size="xsmall" color="grey-neutral">
              {finding.detail}
            </Text>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SignTransactionFlow({
  title,
  onSign,
}: SignTransactionFlowProps) {
  const {
    pendingTransaction,
    loading,
    error,
    auth,
    handleReject,
    withSigning,
  } = useTransactionSigning()

  const handleApprove = () => withSigning(onSign)
  const riskFindings = pendingTransaction
    ? reviewTransactionDisplay(pendingTransaction.displayValue)
    : []

  return (
    <SignRequestView
      auth={auth}
      title={title}
      hasPending={!!pendingTransaction}
      loading={loading}
      error={error}
      loadingMessage="Loading transaction..."
      chain={pendingTransaction?.chain}
      dapp={pendingTransaction?.dapp}
      accountAddress={pendingTransaction?.account.address}
      requestKind={title}
      onApprove={handleApprove}
      onReject={handleReject}
    >
      {pendingTransaction && (
        <div className="flex w-full flex-col items-center gap-2">
          <TransactionRiskPanel findings={riskFindings} />
          <Text size="small" color="grey-neutral">
            Transaction payload
          </Text>
          <Json
            value={pendingTransaction.displayValue}
            className="max-h-36 text-xs"
          />
        </div>
      )}
    </SignRequestView>
  )
}
