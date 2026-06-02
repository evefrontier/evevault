import type {
  ParsedTransactionWithDisplay,
  PendingTransaction,
} from '@evevault/shared/types'
import { parseTransactionBytes } from '@evevault/shared/utils'
import { usePendingSignAction } from './usePendingSignAction'

async function parsePendingTransaction(
  pendingAction: unknown,
): Promise<ParsedTransactionWithDisplay> {
  const pending = pendingAction as Partial<PendingTransaction>
  if (!pending.transaction) {
    throw new Error('No transaction found')
  }

  const parsedTx = await parseTransactionBytes(pending.transaction)
  return {
    ...(pendingAction as PendingTransaction),
    transaction: parsedTx.transactionForSigning ?? pending.transaction,
    displayValue: parsedTx.displayValue,
  }
}

export function usePendingTransaction() {
  const pendingAction = usePendingSignAction({
    parsePending: parsePendingTransaction,
    missingError: 'No pending transaction found',
    rejectError: 'Transaction rejected by user',
    rejectFailureError: 'Failed to reject transaction',
    rejectLogMessage: 'Failed to reject transaction',
    getWindowId: (pending) => pending.windowId,
  })

  return {
    ...pendingAction,
    pendingTransaction: pendingAction.pending,
  }
}
