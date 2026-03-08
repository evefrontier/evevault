import type { SuiChain } from "@mysten/wallet-standard";
import type { User } from "oidc-client-ts";

/**
 * Cache entry for coin metadata with expiry timestamp
 */
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Parameters for the useTransactions hook
 */
export interface UseTransactionsParams {
  user: User | null;
  chain: SuiChain | null;
  pageSize?: number;
}

/**
 * Parameters for the useBalance hook
 */
export interface UseBalanceParams {
  user: User | null;
  chain: SuiChain | null;
  coinType?: string;
}

/**
 * Token metadata returned with balance (decimals, symbol, name, etc.)
 */
export interface BalanceMetadata {
  decimals: number;
  symbol: string;
  name: string;
  description?: string | null;
  iconUrl?: string | null;
}

/**
 * Result shape returned by useBalance (and balance query)
 */
export interface CoinBalanceResult {
  rawBalance: string;
  formattedBalance: string;
  metadata: BalanceMetadata | null;
  coinType: string;
}
