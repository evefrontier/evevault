import type { Transaction, TransactionBalanceChange } from '#/types/components'
import { formatAddress, formatDisplayAmount, SUI_COIN_TYPE } from '#/utils'

export type TransactionStatusMessage = {
  color: 'error' | 'grey-neutral'
  text: string
}

export function getTransactionsFromPages(
  pages?: { transactions: Transaction[] }[],
) {
  return pages?.flatMap((page) => page.transactions) ?? []
}

export function getNextExpandedDigest(
  expandedDigest: string | null,
  digest: string,
) {
  return expandedDigest === digest ? null : digest
}

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

export function getSummaryAmounts(transaction: Transaction) {
  const summaryAmountsRaw = transaction.balanceChanges
    .map(formatBalanceChangeSummary)
    .join(', ')

  if (transaction.direction === 'sent' && summaryAmountsRaw) {
    return `−${summaryAmountsRaw}`
  }

  return summaryAmountsRaw
}

export function getTransactionRowSummary(transaction: Transaction) {
  return {
    iconName: transaction.direction === 'sent' ? 'ArrowRight' : 'ArrowLeft',
    shortCounterparty: formatAddress(transaction.counterparty, 6, 6),
    shortDigest: formatAddress(transaction.digest, 8, 8),
    summaryAmounts: getSummaryAmounts(transaction),
  } as const
}

export function getBalanceChangeTitle(balanceChange: TransactionBalanceChange) {
  if (!balanceChange.tokenName) return null
  return `${balanceChange.coinType === SUI_COIN_TYPE ? 'Gas' : 'Token'}: ${
    balanceChange.tokenName
  }`
}

export function getBalanceChangeAmount(
  balanceChange: TransactionBalanceChange,
) {
  const formattedAmount = formatDisplayAmount(balanceChange.amount, 5)
  const sign = balanceChange.isDebit ? '−' : ''
  return `${sign}${formattedAmount} ${balanceChange.tokenSymbol}`
}

export function openExternalUrl(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}
