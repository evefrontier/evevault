import type React from 'react'
import { useMemo, useState } from 'react'
import { getHeaderIdentity } from '#/auth'
import { SubpageHeader } from '#/components/Layout'
import { useDeviceStore } from '#/stores/deviceStore'
import type { TransactionsScreenProps } from '#/types/components'
import { useActiveSuiAddress, useTransactionHistory } from '#/wallet'
import {
  getNextExpandedDigest,
  getTransactionStatusMessage,
  getTransactionsFromPages,
} from './TransactionsScreen.helpers'
import {
  LoadMoreTransactionsButton,
  TransactionsList,
  TransactionsTableHeader,
} from './TransactionsScreen.parts'
import './TransactionsScreen.css'

export const TransactionsScreen: React.FC<TransactionsScreenProps> = ({
  user,
  chain,
  onBack,
}) => {
  const [expandedTx, setExpandedTx] = useState<string | null>(null)
  const {
    localnet: { url: localnetUrl },
  } = useDeviceStore()
  const senderAddress = useActiveSuiAddress()

  const {
    data,
    isLoading,
    isError,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useTransactionHistory({
    user,
    chain: chain as `sui:${'mainnet' | 'testnet' | 'devnet' | 'localnet'}`,
  })

  const transactions = useMemo(() => {
    return getTransactionsFromPages(data?.pages)
  }, [data?.pages])

  const handleToggleExpand = (digest: string) => {
    setExpandedTx(getNextExpandedDigest(expandedTx, digest))
  }

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }

  const hasTransactions = transactions.length > 0
  const statusMessage = getTransactionStatusMessage({
    error,
    hasTransactions,
    isError,
    isLoading,
  })
  const { email, address } = getHeaderIdentity(user)

  return (
    <div className="tx-screen">
      <SubpageHeader
        title="Transactions"
        email={email}
        address={address}
        onBack={onBack}
      />

      <div className="tx-panel c-panel">
        <TransactionsTableHeader />
        <TransactionsList
          chain={chain}
          expandedTx={expandedTx}
          localnetUrl={localnetUrl ?? undefined}
          onToggleExpand={handleToggleExpand}
          senderAddress={senderAddress ?? undefined}
          statusMessage={statusMessage}
          transactions={transactions}
        />
      </div>

      <LoadMoreTransactionsButton
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        isLoading={isLoading}
        onLoadMore={handleLoadMore}
      />
    </div>
  )
}

export default TransactionsScreen
