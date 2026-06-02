import Json from '@evevault/shared/components/Json'
import { createLogger } from '@evevault/shared/utils'
import { useWalletSigningContext } from '@evevault/shared/wallet'
import { usePendingTransaction } from '@/features/wallet/hooks'
import { prepareAndSignTransaction } from '@/features/wallet/transactionSigning'
import { SignRequestView } from './SignRequestView'

const log = createLogger()

function SignTransaction() {
  const { getSenderAddress, isLocalnet, sign, suiClient } =
    useWalletSigningContext()
  const {
    pendingTransaction,
    loading,
    setLoading,
    error,
    setError,
    auth,
    handleReject,
    storeErrorResult,
  } = usePendingTransaction()

  const handleApprove = async () => {
    if (!pendingTransaction) {
      log.error('No pending transaction found')
      return
    }
    try {
      setLoading(true)
      setError(null)

      const { bytes, signature, windowId } = await prepareAndSignTransaction({
        pendingTransaction,
        auth,
        getSenderAddress,
        isLocalnet,
        sign,
        suiClient,
      })

      await chrome.storage.local.set({
        transactionResult: {
          windowId,
          status: 'signed',
          bytes,
          signature,
        },
      })

      window.close()
    } catch (err) {
      log.error('Transaction signing failed', err)
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
      title="Sign Transaction"
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

export default SignTransaction
