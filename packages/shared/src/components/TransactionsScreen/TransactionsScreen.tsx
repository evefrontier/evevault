import type React from 'react'
import { useMemo, useState } from 'react'
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
  TransactionsHeader,
  TransactionsList,
  TransactionsTableHeader,
} from './TransactionsScreen.parts'

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

  return (
    <div className="flex flex-col gap-4 w-full">
      <TransactionsHeader
        email={user?.profile?.email ?? ''}
        onBack={onBack}
        suiAddress={user?.profile?.sui_address ?? ''}
      />

      <div className="flex flex-col items-start p-4 px-2 gap-4 w-full min-h-[207px] bg-crude-dark border border-quantum-60">
        <TransactionsTableHeader />

        <div className="flex flex-col items-start gap-1 w-full max-h-[350px] overflow-y-auto">
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
    </div>
  )
}

export default TransactionsScreen
