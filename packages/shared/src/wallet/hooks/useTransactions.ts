/**
 * useTransactions Hook
 *
 * Fetches transaction history using Sui GraphQL RPC (Beta).
 * This is the future-proof approach as JSON-RPC is deprecated
 * and will be deactivated by April 2026.
 *
 * Reference: https://docs.sui.io/concepts/data-access/graphql-rpc
 */

import { parseStructTag } from "@mysten/sui/utils";
import { SUI_DEVNET_CHAIN, type SuiChain } from "@mysten/wallet-standard";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { User } from "oidc-client-ts";
import { useMemo } from "react";
import { createSuiClient } from "../../sui";
import { createSuiGraphQLClient } from "../../sui/graphqlClient";
import type { Transaction, TransactionDirection } from "../../types/components";
import { createLogger, formatByDecimals, SUI_COIN_TYPE } from "../../utils";
import {
  type GraphQLTransactionNode,
  TRANSACTIONS_QUERY,
  type TransactionPage,
  type TransactionsQueryResponse,
} from "../types/graphql";
import type { CacheEntry, UseTransactionsParams } from "../types/hooks";

const log = createLogger();
const DEFAULT_PAGE_SIZE = 50;

const coinMetadataCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes cache expiry

/**
 * Manually invalidate cache for a specific coin type or clear entire cache
 */
export function invalidateCoinMetadataCache(coinType?: string): void {
  if (coinType) {
    coinMetadataCache.delete(coinType);
  } else {
    coinMetadataCache.clear();
  }
}

/**
 * Fetches coin metadata for a given coin type
 */
async function fetchCoinMetadata(
  suiClient: ReturnType<typeof createSuiClient>,
  coinType: string,
): Promise<{ decimals: number; symbol: string } | null> {
  try {
    // Check cache first with expiry
    const cached = coinMetadataCache.get(coinType);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    // Remove expired entry if it exists
    if (cached) {
      coinMetadataCache.delete(coinType);
    }

    // For SUI, we know the metadata
    if (coinType === SUI_COIN_TYPE) {
      const metadata = { decimals: 9, symbol: "SUI" };
      coinMetadataCache.set(coinType, {
        data: metadata,
        timestamp: Date.now(),
      });
      return metadata;
    }

    // Fetch metadata for other coins
    const metadata = await suiClient.getCoinMetadata({ coinType });

    if (!metadata) {
      log.warn("No metadata found for coin type", { coinType });
      return null;
    }

    const result = {
      decimals: metadata.decimals,
      symbol: metadata.symbol,
    };

    // Cache the result with timestamp
    coinMetadataCache.set(coinType, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    log.error("Failed to fetch coin metadata", { coinType, error });
    return null;
  }
}

/**
 * Extracts the symbol from a coin type string
 * Uses Mysten Labs parseStructTag for proper parsing
 * e.g., "0x2::sui::SUI" -> "SUI"
 */
function extractSymbolFromCoinType(coinType: string): string {
  try {
    const struct = parseStructTag(coinType);
    return struct.name || coinType;
  } catch {
    // Fallback to simple parsing if parseStructTag fails
    const parts = coinType.split("::");
    return parts[parts.length - 1] || coinType;
  }
}

/**
 * Formats transaction amount based on coin type using metadata
 */
async function formatTransactionAmount(
  rawAmount: string,
  coinType: string,
  suiClient: ReturnType<typeof createSuiClient>,
): Promise<string> {
  const metadata = await fetchCoinMetadata(suiClient, coinType);
  let decimals: number;

  if (metadata) {
    decimals = metadata.decimals;
  } else {
    // Fallback to 9 decimals (SUI default) if metadata is unavailable.
    // This may be incorrect for non-SUI tokens, so we log a warning for observability.
    decimals = 9;
    log.warn("Falling back to default decimals for coin type", {
      coinType,
      rawAmount,
      defaultDecimals: decimals,
    });
  }

  return formatByDecimals(rawAmount, decimals);
}

/**
 * Parses a GraphQL transaction response into our Transaction format
 *
 * Note: In the current schema (2025+), timestamp is on effects, not transaction,
 * and BalanceChange.owner is an Address object directly (not Owner union).
 */
async function parseGraphQLTransaction(
  txNode: GraphQLTransactionNode,
  userAddress: string,
  suiClient: ReturnType<typeof createSuiClient>,
): Promise<Transaction | null> {
  const { digest, effects } = txNode;

  if (!digest || !effects?.balanceChanges?.nodes) {
    return null;
  }

  const timestamp = effects.timestamp;
  const balanceChanges = effects.balanceChanges.nodes;

  if (balanceChanges.length === 0) {
    return null;
  }

  // Find the balance change relevant to the user
  const userBalanceChange = balanceChanges.find((bc) => {
    const ownerAddress = bc.owner?.address;
    return ownerAddress?.toLowerCase() === userAddress.toLowerCase();
  });

  if (!userBalanceChange || !userBalanceChange.amount) {
    // If no balance change for user, try to find outgoing transaction
    const outgoingChange = balanceChanges.find((bc) => {
      if (!bc.amount) return false;
      const amount = BigInt(bc.amount);
      return amount < 0n;
    });

    if (!outgoingChange || !outgoingChange.amount) {
      return null;
    }

    // User sent this transaction - find recipient
    const recipientChange = balanceChanges.find((bc) => {
      if (!bc.amount) return false;
      const amount = BigInt(bc.amount);
      if (amount <= 0n) return false;
      const ownerAddress = bc.owner?.address;
      return ownerAddress?.toLowerCase() !== userAddress.toLowerCase();
    });

    // If no recipient found, it's likely a gas-only or system-level transaction
    const counterparty = recipientChange?.owner?.address || "System";

    const amountAbs = BigInt(outgoingChange.amount) * -1n;
    const coinType = outgoingChange.coinType?.repr || SUI_COIN_TYPE;

    return {
      digest,
      timestamp: timestamp ? new Date(timestamp).getTime() : Date.now(),
      direction: "sent" as TransactionDirection,
      counterparty,
      amount: await formatTransactionAmount(
        amountAbs.toString(),
        coinType,
        suiClient,
      ),
      tokenSymbol: extractSymbolFromCoinType(coinType),
      coinType,
    };
  }

  const amount = BigInt(userBalanceChange.amount);
  const direction: TransactionDirection = amount >= 0n ? "received" : "sent";
  const coinType = userBalanceChange.coinType?.repr || SUI_COIN_TYPE;

  // Find counterparty (sender if received, recipient if sent)
  let counterparty: string;

  if (direction === "received") {
    // Find who sent it (negative balance change)
    const senderChange = balanceChanges.find((bc) => {
      if (!bc.amount) return false;
      const bcAmount = BigInt(bc.amount);
      if (bcAmount >= 0n) return false;
      const ownerAddress = bc.owner?.address;
      return ownerAddress?.toLowerCase() !== userAddress.toLowerCase();
    });

    // If no sender found, it's likely a mint/system-originated transfer
    counterparty = senderChange?.owner?.address || "System";
  } else {
    // Find who received it (positive balance change)
    const recipientChange = balanceChanges.find((bc) => {
      if (!bc.amount) return false;
      const bcAmount = BigInt(bc.amount);
      if (bcAmount <= 0n) return false;
      const ownerAddress = bc.owner?.address;
      return ownerAddress?.toLowerCase() !== userAddress.toLowerCase();
    });

    // If no recipient found, it's likely a gas-only or system-level transaction
    counterparty = recipientChange?.owner?.address || "System";
  }

  const amountAbs = amount >= 0n ? amount : amount * -1n;

  return {
    digest,
    timestamp: timestamp ? new Date(timestamp).getTime() : Date.now(),
    direction,
    counterparty,
    amount: await formatTransactionAmount(
      amountAbs.toString(),
      coinType,
      suiClient,
    ),
    tokenSymbol: extractSymbolFromCoinType(coinType),
    coinType,
  };
}

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
export function useTransactions({
  user,
  chain,
  pageSize = DEFAULT_PAGE_SIZE,
}: UseTransactionsParams) {
  const graphqlClient = useMemo(() => {
    const currentChain = chain || SUI_DEVNET_CHAIN;
    return createSuiGraphQLClient(currentChain);
  }, [chain]);

  const suiClient = useMemo(() => {
    const currentChain = chain || SUI_DEVNET_CHAIN;
    return createSuiClient(currentChain);
  }, [chain]);

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
          parseGraphQLTransaction(node, userAddress, suiClient),
        ),
      );

      const transactions = parsedTransactions
        .filter((tx): tx is Transaction => tx !== null)
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
    enabled: !!userAddress && !!chain && !!graphqlClient && !!suiClient,
    staleTime: 1000 * 60, // 1 minute
    retry: 2,
  });
}
