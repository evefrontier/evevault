import type {
  Transaction,
  TransactionBalanceChange,
  TransactionStatusMessage,
} from '#/types/components'
import { formatAddress, formatDisplayAmount, SUI_COIN_TYPE } from '#/utils'

/**
 * Normalizes TanStack Query pages so the screen can stay independent from the
 * pagination shape returned by the transaction service.
 */
export function getTransactionsFromPages(
  pages?: { transactions: Transaction[] }[],
) {
  return pages?.flatMap((page) => page.transactions) ?? []
}

/**
 * Keeps expansion state as a single digest because only one transaction row
 * should be open at a time in the compact extension layout.
 */
export function getNextExpandedDigest(
  expandedDigest: string | null,
  digest: string,
) {
  return expandedDigest === digest ? null : digest
}

/**
 * Centralizes status precedence so error, loading, and empty states do not
 * drift between the desktop table and extension list presentations.
 */
export function getTransactionStatusMessage({
  error,
  hasTransactions,
  isError,
  isLoading,
}: {
  error?: Error | null
  hasTransactions: boolean
  isError: boolean
  isLoading: boolean
}): TransactionStatusMessage | null {
  if (isError) {
    return {
      color: 'error',
      text: error?.message || 'Failed to load transactions',
    }
  }

  if (isLoading) {
    return {
      color: 'grey-neutral',
      text: 'Loading transactions...',
    }
  }

  if (!hasTransactions) {
    return {
      color: 'grey-neutral',
      text: 'No transactions found',
    }
  }

  return null
}

/**
 * Builds the row class list in one place because the summary row is reused by
 * both collapsed and expanded states.
 */
export function getSummaryClasses(isExpanded: boolean) {
  return [
    'flex w-full p-2 items-center justify-between gap-2',
    'border-none cursor-pointer text-left transition-colors',
    isExpanded
      ? 'bg-quantum-40 hover:bg-quantum-40'
      : 'bg-transparent hover:bg-quantum-10',
  ].join(' ')
}

function formatBalanceChangeSummary(balanceChange: TransactionBalanceChange) {
  return `${formatDisplayAmount(balanceChange.amount, 5)} ${
    balanceChange.tokenSymbol
  }`
}

function getSummaryAmounts(transaction: Transaction) {
  const summaryAmountsRaw = transaction.balanceChanges
    .map(formatBalanceChangeSummary)
    .join(', ')

  if (transaction.direction === 'sent' && summaryAmountsRaw) {
    return `−${summaryAmountsRaw}`
  }

  return summaryAmountsRaw
}

/**
 * Precomputes row display fields so the JSX parts do not duplicate address
 * truncation or sent/received direction logic.
 */
export function getTransactionRowSummary(transaction: Transaction) {
  return {
    iconName: transaction.direction === 'sent' ? 'ArrowRight' : 'ArrowLeft',
    shortCounterparty: formatAddress(transaction.counterparty, 6, 6),
    shortDigest: formatAddress(transaction.digest, 8, 8),
    summaryAmounts: getSummaryAmounts(transaction),
  } as const
}

/**
 * Labels gas separately from token changes because both can appear in the same
 * transaction details block.
 */
export function getBalanceChangeTitle(balanceChange: TransactionBalanceChange) {
  if (!balanceChange.tokenName) return null
  return `${balanceChange.coinType === SUI_COIN_TYPE ? 'Gas' : 'Token'}: ${
    balanceChange.tokenName
  }`
}

/**
 * Applies the debit sign at render time because stored balance changes keep
 * amounts unsigned for easier aggregation.
 */
export function getBalanceChangeAmount(
  balanceChange: TransactionBalanceChange,
) {
  const formattedAmount = formatDisplayAmount(balanceChange.amount, 5)
  const sign = balanceChange.isDebit ? '−' : ''
  return `${sign}${formattedAmount} ${balanceChange.tokenSymbol}`
}

/**
 * Wraps window.open to keep external transaction links consistently isolated
 * from the extension window.
 */
export function openExternalUrl(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}
