import type { SuiClientTypes } from '@mysten/sui/client'
import { toBase64 } from '@mysten/sui/utils'

export function parseExecResult(
  execResult: SuiClientTypes.TransactionResult<{ effects: true }>,
): { digest: string; effects: string } {
  if (execResult.$kind === 'FailedTransaction') {
    const failedTx = execResult.FailedTransaction
    const errorMessage =
      failedTx?.status &&
      typeof failedTx.status === 'object' &&
      'error' in failedTx.status
        ? String(
            (failedTx.status as { error?: { message?: string } }).error
              ?.message ?? 'Transaction failed',
          )
        : 'Transaction failed'
    throw new Error(errorMessage)
  }

  if (
    !execResult.Transaction?.digest ||
    execResult.Transaction.effects?.bcs == null
  ) {
    throw new Error('Transaction execution result is missing digest or effects')
  }

  return {
    digest: execResult.Transaction.digest,
    effects: toBase64(execResult.Transaction.effects.bcs),
  }
}
