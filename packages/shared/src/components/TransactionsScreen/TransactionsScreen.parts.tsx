import type React from 'react'
import Button from '#/components/Button'
import Heading from '#/components/Heading'
import Icon from '#/components/Icon'
import { HeaderMobile } from '#/components/Layout'
import Text from '#/components/Text'
import type {
  Transaction,
  TransactionBalanceChange,
  TransactionRowProps,
} from '#/types/components'
import { formatShortDate, getSuiscanUrl } from '#/utils'
import {
  getBalanceChangeAmount,
  getBalanceChangeTitle,
  getSummaryClasses,
  getTransactionRowSummary,
  openExternalUrl,
  type TransactionStatusMessage,
} from './TransactionsScreen.helpers'

export function TransactionsHeader({
  email,
  onBack,
  suiAddress,
}: {
  email?: string
  onBack: () => void
  suiAddress?: string
}) {
  return (
    <>
      <HeaderMobile
        address={suiAddress ?? ''}
        email={email ?? ''}
        onTransactionsClick={onBack}
      />
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center p-1 bg-transparent border-none cursor-pointer hover:opacity-80"
        >
          <Icon name="ArrowLeft" size="medium" color="quantum" />
        </button>
        <Heading level={2}>Transactions</Heading>
      </div>
    </>
  )
}

export function TransactionsTableHeader() {
  return (
    <div className="flex justify-between items-start gap-2 w-full px-2">
      <div className="flex items-center">
        <Text
          variant="label-semi"
          size="small"
          color="neutral-50"
          className="w-[72px] shrink-0"
        >
          Date
        </Text>
        <Text variant="label-semi" size="small" color="neutral-50">
          Sender / Recipient
        </Text>
      </div>
      <Text
        variant="label-semi"
        size="small"
        color="neutral-50"
        className="text-right shrink-0"
      >
        Amount
      </Text>
    </div>
  )
}

export function TransactionsStatus({
  statusMessage,
}: {
  statusMessage: TransactionStatusMessage
}) {
  return (
    <div className="flex justify-center items-center py-6 w-full">
      <Text size="large" color={statusMessage.color}>
        {statusMessage.text}
      </Text>
    </div>
  )
}

function TransactionBalanceChangeRow({
  balanceChange,
}: {
  balanceChange: TransactionBalanceChange
}) {
  const title = getBalanceChangeTitle(balanceChange)

  return (
    <div className="flex flex-col gap-0.5">
      {title ? (
        <Text variant="light" size="xsmall" color="neutral-50">
          {title}
        </Text>
      ) : null}
      <Text variant="light" size="small" color="neutral-90">
        {getBalanceChangeAmount(balanceChange)}
      </Text>
    </div>
  )
}

function TransactionBalanceChanges({
  transaction,
}: {
  transaction: Transaction
}) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      {transaction.balanceChanges.map((balanceChange) => (
        <TransactionBalanceChangeRow
          key={`${balanceChange.coinType}-${balanceChange.amount}-${String(
            balanceChange.isDebit,
          )}`}
          balanceChange={balanceChange}
        />
      ))}
    </div>
  )
}

function TransactionDigest({ shortDigest }: { shortDigest: string }) {
  return (
    <div className="flex flex-col gap-0.5 items-end">
      <Text variant="light" size="xsmall" color="neutral-50">
        Transaction:
      </Text>
      <Text variant="light" size="small" color="neutral-90">
        {shortDigest}
      </Text>
    </div>
  )
}

function TransactionDetails({
  shortDigest,
  suiscanUrl,
  transaction,
}: {
  shortDigest: string
  suiscanUrl: string
  transaction: Transaction
}) {
  return (
    <div className="flex items-start justify-between w-full px-2 pb-2 gap-4 bg-quantum-40">
      <TransactionBalanceChanges transaction={transaction} />
      <div className="flex flex-col gap-2 items-end shrink-0">
        <TransactionDigest shortDigest={shortDigest} />
        <Button
          variant="secondary"
          size="small"
          onClick={() => openExternalUrl(suiscanUrl)}
        >
          View on Suiscan
        </Button>
      </div>
    </div>
  )
}

function TransactionSummary({
  formattedDate,
  isExpanded,
  onToggle,
  transaction,
}: {
  formattedDate: string
  isExpanded: boolean
  onToggle: () => void
  transaction: Transaction
}) {
  const { iconName, shortCounterparty, summaryAmounts } =
    getTransactionRowSummary(transaction)

  return (
    <button
      type="button"
      className={getSummaryClasses(isExpanded)}
      onClick={onToggle}
      aria-expanded={isExpanded}
    >
      <div className="flex items-center">
        <div className="flex items-center w-[72px] shrink-0">
          <Text variant="light" size="small">
            {formattedDate}
          </Text>
        </div>
        <div className="flex items-center gap-1 min-w-0">
          <Icon name={iconName} size="small" color="neutral-50" aria-hidden />
          <Text variant="light" size="small" color="neutral-90">
            {shortCounterparty}
          </Text>
        </div>
      </div>
      <div className="flex items-center text-right shrink-0">
        <Text variant="regular" size="small">
          {summaryAmounts}
        </Text>
      </div>
    </button>
  )
}

export const TransactionRow: React.FC<TransactionRowProps> = ({
  transaction,
  chain,
  localnetUrl,
  isExpanded,
  onToggle,
}) => {
  const suiscanUrl = getSuiscanUrl(chain, transaction.digest, {
    localnetUrl,
  })
  const formattedDate = formatShortDate(transaction.timestamp)
  const { shortDigest } = getTransactionRowSummary(transaction)

  return (
    <div className="flex flex-col w-full">
      <TransactionSummary
        formattedDate={formattedDate}
        isExpanded={isExpanded}
        onToggle={onToggle}
        transaction={transaction}
      />

      {isExpanded ? (
        <TransactionDetails
          shortDigest={shortDigest}
          suiscanUrl={suiscanUrl}
          transaction={transaction}
        />
      ) : null}
    </div>
  )
}

export function TransactionsList({
  chain,
  expandedTx,
  localnetUrl,
  onToggleExpand,
  senderAddress,
  statusMessage,
  transactions,
}: {
  chain: string
  expandedTx: string | null
  localnetUrl?: string
  onToggleExpand: (digest: string) => void
  senderAddress?: string
  statusMessage: TransactionStatusMessage | null
  transactions: Transaction[]
}) {
  if (statusMessage) {
    return <TransactionsStatus statusMessage={statusMessage} />
  }

  return transactions.map((transaction) => (
    <TransactionRow
      key={transaction.digest}
      transaction={transaction}
      chain={chain}
      localnetUrl={localnetUrl}
      senderAddress={senderAddress}
      isExpanded={expandedTx === transaction.digest}
      onToggle={() => onToggleExpand(transaction.digest)}
    />
  ))
}

export function LoadMoreTransactionsButton({
  hasNextPage,
  isFetchingNextPage,
  isLoading,
  onLoadMore,
}: {
  hasNextPage?: boolean
  isFetchingNextPage: boolean
  isLoading: boolean
  onLoadMore: () => void
}) {
  if (!hasNextPage || isLoading) return null

  return (
    <div className="flex justify-center w-full pt-2">
      <Button
        variant="secondary"
        size="small"
        onClick={onLoadMore}
        isLoading={isFetchingNextPage}
      >
        {isFetchingNextPage ? 'Loading...' : 'Load more'}
      </Button>
    </div>
  )
}
