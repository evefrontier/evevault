import Json from '@evevault/shared/components/Json'
import { createLogger } from '@evevault/shared/utils'
import { useWalletSigningContext } from '@evevault/shared/wallet'
import { useQueryClient } from '@tanstack/react-query'
import { usePendingTransaction } from '@/features/wallet/hooks'
import { prepareAndSignTransaction } from '@/features/wallet/transactionSigning'
import { parseExecResult } from './parseExecResult'
import { SignRequestView } from './SignRequestView'

const log = createLogger()

function SignAndExecuteTransaction() {
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
  const queryClient = useQueryClient()

  const handleApprove = async () => {
    if (!pendingTransaction) {
      log.error('No pending transaction found')
      return
    }
    try {
      setLoading(true)
      setError(null)

      const { bytes, signature, txb, windowId } =
        await prepareAndSignTransaction({
          pendingTransaction,
          auth,
          getSenderAddress,
          isLocalnet,
          sign,
          suiClient,
        })

      const execResult = await suiClient.executeTransaction({
        transaction: txb,
        signatures: [signature],
        include: { effects: true },
      })

      const { digest, effects } = parseExecResult(execResult)

      await chrome.storage.local.set({
        transactionResult: {
          windowId,
          status: 'signed_and_executed',
          bytes,
          signature,
          digest,
          effects,
        },
      })

      // Don't await so close isn't delayed
      queryClient.invalidateQueries({ queryKey: ['coin-balance'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })

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
      title="Sign and Execute Transaction"
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

export default SignAndExecuteTransaction
