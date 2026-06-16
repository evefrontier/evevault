import { Text } from '@evevault/shared/components'
import Json from '@evevault/shared/components/Json'
import { useTransactionSigning } from '@/features/wallet/hooks'
import type { SignResult } from '@/features/wallet/hooks/useTransactionSigning'
import { SignRequestView } from './SignRequestView'

interface SignTransactionFlowProps {
  title: string
  onSign: (result: SignResult) => Promise<void>
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
