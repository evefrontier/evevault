import { createLogger } from '@evevault/shared/utils'
import { useWalletSigningContext } from '@evevault/shared/wallet'
import { prepareAndSignTransaction } from '@/features/wallet/transactionSigning'
import { usePendingTransaction } from './usePendingTransaction'

const log = createLogger()

export type SignResult = Awaited<ReturnType<typeof prepareAndSignTransaction>>

// useTransactionSigning returns `storeResult`, so StoreResult is part of this
// hook's public contract; re-exporting it lets consumers get the value and the
// type that describes it from one module, keeping usePendingSignAction internal.
export type { StoreResult } from './usePendingSignAction'

export function useTransactionSigning() {
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
    storeResult,
    storeErrorResult,
  } = usePendingTransaction()

  const withSigning = async (
    onSigned: (result: SignResult) => Promise<void>,
  ) => {
    if (!pendingTransaction) {
      log.error('No pending transaction found')
      return
    }
    try {
      setLoading(true)
      setError(null)
      const result = await prepareAndSignTransaction({
        pendingTransaction,
        auth,
        getSenderAddress,
        isLocalnet,
        sign,
        suiClient,
      })
      await onSigned(result)
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

  return {
    pendingTransaction,
    loading,
    error,
    auth,
    handleReject,
    withSigning,
    storeResult,
    suiClient,
  }
}
