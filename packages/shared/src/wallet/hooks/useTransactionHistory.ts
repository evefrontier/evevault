/**
 * useTransactionHistory Hook
 *
 * Fetches transaction history using Sui GraphQL RPC (Beta).
 *
 * Reference: https://docs.sui.io/concepts/data-access/graphql-rpc
 */

import { SUI_TESTNET_CHAIN } from '@mysten/wallet-standard'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { createSuiGraphQLClient } from '#/sui/graphqlClient'
import { createLogger, isNonNullable } from '#/utils'
import { TRANSACTIONS_QUERY } from '#/wallet/queries/transactions'
import type {
  GraphQLTransactionNode,
  TransactionPage,
  TransactionsQueryResponse,
} from '#/wallet/types/graphql'
import type { UseTransactionsParams } from '#/wallet/types/hooks'
import { parseGraphQLTransaction } from '#/wallet/utils/parseTransaction'

const log = createLogger()
const DEFAULT_PAGE_SIZE = 50

/**
 * Hook to fetch transaction history using Sui GraphQL RPC
 *
 * Uses the GraphQL Beta endpoints which are the recommended approach
 * for future-proof data access on Sui.
 *
 * Features:
 * - Cursor-based pagination (50 items per page)
 * - Both sent and received transactions
 * - Balance changes with token info
 *
 * @see https://docs.sui.io/concepts/data-access/graphql-rpc
 */
export function useTransactionHistory({
  user,
  chain,
  pageSize = DEFAULT_PAGE_SIZE,
}: UseTransactionsParams) {
  const currentChain = chain || SUI_TESTNET_CHAIN

  const graphqlClient = useMemo(
    () => createSuiGraphQLClient(currentChain),
    [currentChain],
  )

  const userAddress = user?.profile?.sui_address as string | undefined

  return useInfiniteQuery<TransactionPage>({
    queryKey: ['transactions', 'graphql', userAddress, chain, pageSize],
    queryFn: async ({ pageParam }) => {
      if (!userAddress || !graphqlClient) {
        throw new Error('Missing user address or client')
      }

      log.debug('Fetching transactions via GraphQL', {
        address: userAddress,
        chain,
        cursor: pageParam,
      })

      const result = await graphqlClient.query<TransactionsQueryResponse>({
        query: TRANSACTIONS_QUERY,
        variables: {
          address: userAddress,
          last: pageSize,
          before: pageParam as string | undefined,
        },
      })

      if (result.errors && result.errors.length > 0) {
        const errorMessage = result.errors.map((e) => e.message).join(', ')
        log.error('GraphQL query errors', { errors: result.errors })
        throw new Error(`GraphQL query failed: ${errorMessage}`)
      }

      const transactionsData = result.data?.address?.transactions

      if (!transactionsData) {
        log.debug('No transactions found')
        return {
          transactions: [],
          prevCursor: null,
          hasPreviousPage: false,
        }
      }

      // Connection nodes are oldest-first; reverse so each page reads
      // newest-first without re-sorting by timestamp.
      const parsed = await Promise.all(
        transactionsData.nodes
          .slice()
          .reverse()
          .map((node: GraphQLTransactionNode) =>
            parseGraphQLTransaction(node, userAddress, graphqlClient),
          ),
      )

      const transactions = parsed.filter(isNonNullable)

      log.debug('Transactions fetched successfully via GraphQL', {
        count: transactions.length,
        hasPreviousPage: transactionsData.pageInfo.hasPreviousPage,
      })

      return {
        transactions,
        prevCursor: transactionsData.pageInfo.startCursor ?? null,
        hasPreviousPage: transactionsData.pageInfo.hasPreviousPage,
      }
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasPreviousPage ? lastPage.prevCursor : undefined,
    enabled: !!userAddress && !!chain && !!graphqlClient,
    staleTime: 1000 * 60, // 1 minute
    retry: 2,
  })
}
