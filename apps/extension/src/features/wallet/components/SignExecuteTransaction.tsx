import { useWalletSigningContext } from '@evevault/shared/wallet'
import { useQueryClient } from '@tanstack/react-query'
import { parseExecResult } from './parseExecResult'
import { SignTransactionFlow } from './SignTransactionFlow'

function SignAndExecuteTransaction() {
  const { suiClient } = useWalletSigningContext()
  const queryClient = useQueryClient()

  return (
    <SignTransactionFlow
      title="Sign and Execute Transaction"
      onSign={async ({ bytes, signature, txb }, storeResult) => {
        const execResult = await suiClient.executeTransaction({
          transaction: txb,
          signatures: [signature],
          include: { effects: true },
        })

        const { digest, effects } = parseExecResult(execResult)

        const stored = await storeResult({
          status: 'signed_and_executed',
          bytes,
          signature,
          digest,
          effects,
        })
        // A refused write (e.g. missing requestId) must surface as an error.
        if (!stored) {
          throw new Error(
            'Failed to record the signing result. Please try again.',
          )
        }

        // Don't await so close isn't delayed
        queryClient.invalidateQueries({ queryKey: ['coin-balance'] })
        queryClient.invalidateQueries({ queryKey: ['transactions'] })
      }}
    />
  )
}

export default SignAndExecuteTransaction
