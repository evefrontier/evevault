/**
 * useTransactionHistory Hook
 *
 * Fetches transaction history using Sui GraphQL RPC (Beta).
 *
 * Reference: https://docs.sui.io/concepts/data-access/graphql-rpc
 */

import { SUI_TESTNET_CHAIN } from "@mysten/wallet-standard";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { createSuiGraphQLClient } from "../../sui/graphqlClient";
import { createLogger } from "../../utils";
import { TRANSACTIONS_QUERY } from "../queries/transactions";
import type {
  GraphQLTransactionNode,
  TransactionPage,
  TransactionsQueryResponse,
} from "../types/graphql";
import type { UseTransactionsParams } from "../types/hooks";
import { parseGraphQLTransaction } from "../utils/parseTransaction";

const log = createLogger();
const DEFAULT_PAGE_SIZE = 50;

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
  const currentChain = chain || SUI_TESTNET_CHAIN;

  const graphqlClient = useMemo(
    () => createSuiGraphQLClient(currentChain),
    [currentChain],
  );

  const userAddress = user?.profile?.sui_address as string | undefined;

  return useInfiniteQuery<TransactionPage>({
    queryKey: ["transactions", "graphql", userAddress, chain, pageSize],
    queryFn: async ({ pageParam }) => {
      if (!userAddress || !graphqlClient) {
        throw new Error("Missing user address or client");
      }

      log.debug("Fetching transactions via GraphQL", {
        address: userAddress,
        chain,
        cursor: pageParam,
      });

      const result = await graphqlClient.query<TransactionsQueryResponse>({
        query: TRANSACTIONS_QUERY,
        variables: {
          address: userAddress,
          first: pageSize,
          after: pageParam as string | undefined,
        },
      });

      if (result.errors && result.errors.length > 0) {
        const errorMessage = result.errors.map((e) => e.message).join(", ");
        log.error("GraphQL query errors", { errors: result.errors });
        throw new Error(`GraphQL query failed: ${errorMessage}`);
      }

      const transactionsData = result.data?.address?.transactions;

      if (!transactionsData) {
        log.debug("No transactions found");
        return {
          transactions: [],
          nextCursor: null,
          hasNextPage: false,
        };
      }

      // Parse transactions with metadata fetching (async)
      const parsedTransactions = await Promise.all(
        transactionsData.nodes.map((node: GraphQLTransactionNode) =>
          parseGraphQLTransaction(node, userAddress, graphqlClient),
        ),
      );

      const transactions = parsedTransactions
        .filter(
          (tx): tx is import("../../types/components").Transaction =>
            tx !== null,
        )
        // Sort by timestamp descending (newest first)
        .sort((a, b) => b.timestamp - a.timestamp);

      log.debug("Transactions fetched successfully via GraphQL", {
        count: transactions.length,
        hasNextPage: transactionsData.pageInfo.hasNextPage,
      });

      return {
        transactions,
        nextCursor: transactionsData.pageInfo.endCursor ?? null,
        hasNextPage: transactionsData.pageInfo.hasNextPage,
      };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasNextPage ? lastPage.nextCursor : undefined,
    enabled: !!userAddress && !!chain && !!graphqlClient,
    staleTime: 1000 * 60, // 1 minute
    retry: 2,
  });
}
