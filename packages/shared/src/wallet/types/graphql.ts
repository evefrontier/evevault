/**
 * GraphQL response types for Sui transaction queries
 *
 * These types match the structure returned by the Sui GraphQL API
 * when querying transaction blocks with balance changes.
 *
 * @see https://docs.sui.io/concepts/data-access/graphql-rpc
 */

/**
 * Balance change from a GraphQL transaction response
 */
export interface GraphQLBalanceChange {
  amount: string | null;
  coinType: {
    repr: string | null;
  } | null;
  owner: {
    address: string | null;
  } | null;
}

/**
 * Transaction node from a GraphQL response
 */
export interface GraphQLTransactionNode {
  digest: string | null;
  effects: {
    timestamp: string | null;
    balanceChanges: {
      nodes: GraphQLBalanceChange[];
    } | null;
  } | null;
}

/**
 * Full GraphQL response type for the transactions query
 */
export interface TransactionsQueryResponse {
  address: {
    transactions: {
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
      nodes: GraphQLTransactionNode[];
    } | null;
  } | null;
}

/**
 * Hook return type for transaction pages
 */
export interface TransactionPage {
  transactions: import("../../types/components").Transaction[];
  nextCursor: string | null;
  hasNextPage: boolean;
}
