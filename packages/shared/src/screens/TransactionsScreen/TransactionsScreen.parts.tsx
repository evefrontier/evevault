import type React from 'react'
import Button from '#/components/Button'
import { DirectionIcon } from '#/components/DirectionIcon'
import Text from '#/components/Text'
import { useExplorer } from '#/hooks/useExplorer'
import type {
  Transaction,
  TransactionBalanceChange,
  TransactionRowProps,
  TransactionStatusMessage,
} from '#/types/components'
import { formatShortDate } from '#/utils'
import {
  getBalanceChangeAmount,
  getBalanceChangeTitle,
  getTransactionRowSummary,
  openExternalUrl,
} from './TransactionsScreen.helpers'

export function TransactionsTableHeader() {
  return (
    <div className="tx-head c-label">
      <span>Date</span>
      <span className="tx-head__counterparty">Sender / Recipient</span>
      <span className="tx-head__amount">Amount</span>
    </div>
  )
}

export function TransactionsStatus({
  statusMessage,
}: {
  statusMessage: TransactionStatusMessage
}) {
  return (
    <div className="tx-status">
      <Text color={statusMessage.color}>{statusMessage.text}</Text>
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
    <div className="tx-details__change">
      {title ? <span className="tx-details__label">{title}</span> : null}
      <span className="tx-details__value">
        {getBalanceChangeAmount(balanceChange)}
      </span>
    </div>
  )
}

function TransactionBalanceChanges({
  transaction,
}: {
  transaction: Transaction
}) {
  return (
    <div className="tx-details__changes">
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

function TransactionDetails({
  shortDigest,
  explorerUrl,
  explorerName,
  transaction,
}: {
  shortDigest: string
  explorerUrl: string
  explorerName: string
  transaction: Transaction
}) {
  return (
    <div className="tx-details">
      <TransactionBalanceChanges transaction={transaction} />
      <div className="tx-details__link">
        <span className="tx-details__label">
          Transaction <span className="tx-details__digest">{shortDigest}</span>
        </span>
        <Button
          variant="secondary"
          size="small"
          iconNameRight="ArrowRight"
          onClick={() => openExternalUrl(explorerUrl)}
        >
          View on {explorerName}
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
  const { shortCounterparty, summaryAmounts } =
    getTransactionRowSummary(transaction)
  const sent = transaction.direction === 'sent'

  return (
    <button
      type="button"
      className="tx-row"
      onClick={onToggle}
      aria-expanded={isExpanded}
    >
      <span className="tx-row__date">{formattedDate}</span>
      <DirectionIcon out={sent} />
      <span className="tx-row__who">{shortCounterparty}</span>
      <span className={`tx-row__amount${sent ? '' : ' tx-row__amount--in'}`}>
        {summaryAmounts}
      </span>
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
  const { urlFor, nameFor } = useExplorer()
  const explorerUrl = urlFor(chain, transaction.digest, { localnetUrl })
  const formattedDate = formatShortDate(transaction.timestamp)
  const { shortDigest } = getTransactionRowSummary(transaction)

  return (
    <div>
      <TransactionSummary
        formattedDate={formattedDate}
        isExpanded={isExpanded}
        onToggle={onToggle}
        transaction={transaction}
      />

      {isExpanded ? (
        <TransactionDetails
          shortDigest={shortDigest}
          explorerUrl={explorerUrl}
          explorerName={nameFor(chain)}
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
    <div className="tx-load-more">
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
