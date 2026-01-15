import type { SuiChain } from "@mysten/wallet-standard";
import type { User } from "oidc-client-ts";

/**
 * Cache entry for coin metadata with expiry timestamp
 */
export interface CacheEntry {
  data: { decimals: number; symbol: string };
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
