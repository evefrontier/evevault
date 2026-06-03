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
      onApprove={handleApprove}
      onReject={handleReject}
    >
      {pendingTransaction && (
        <Json value={pendingTransaction.displayValue} className="max-h-24" />
      )}
    </SignRequestView>
  )
}
