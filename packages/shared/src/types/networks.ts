import {
  SUI_DEVNET_CHAIN,
  SUI_TESTNET_CHAIN,
  type SuiChain,
} from "@mysten/wallet-standard";
import { SUI_COIN_TYPE } from "../utils/constants";
import { getEveCoinType } from "../wallet/eveToken";
import type { TenantId } from "./tenant";

export interface NetworkOption {
  chain: SuiChain;
  label: string;
  shortLabel: string;
}

export const AVAILABLE_NETWORKS: NetworkOption[] = [
  { chain: SUI_DEVNET_CHAIN, label: "Devnet", shortLabel: "DEV" },
  { chain: SUI_TESTNET_CHAIN, label: "Testnet", shortLabel: "TEST" },
  // Mainnet will be added later as a feature flag
];

/**
 * Get the display label for a given SuiChain
 * @param chain - The SuiChain to get the label for
 * @returns The display label, or the chain string if not found
 */
export function getNetworkLabel(chain: SuiChain): string {
  return AVAILABLE_NETWORKS.find((n) => n.chain === chain)?.label ?? chain;
}

/**
 * Get the full network option for a given SuiChain
 * @param chain - The SuiChain to get the option for
 * @returns The NetworkOption if found, undefined otherwise
 */
export function getNetworkOption(chain: SuiChain): NetworkOption | undefined {
  return AVAILABLE_NETWORKS.find((n) => n.chain === chain);
}

/** Default token coin types per chain (e.g. SUI + chain-specific tokens like EVE on testnet). Testnet uses stillness tenant's EVE package for static default. */
export const DEFAULT_TOKENS_BY_CHAIN: Record<string, string[]> = {
  [SUI_DEVNET_CHAIN]: [SUI_COIN_TYPE],
  [SUI_TESTNET_CHAIN]: [SUI_COIN_TYPE, getEveCoinType("stillness")],
};

/**
 * Default token list for a chain. Returns a copy so callers can mutate if needed.
 * For testnet, pass tenantId to use that tenant's EVE coin type; otherwise uses DEFAULT_TOKENS_BY_CHAIN (stillness).
 */
export function getDefaultTokensForChain(
  chain: string,
  tenantId?: TenantId,
): string[] {
  if (chain === SUI_TESTNET_CHAIN && tenantId !== undefined) {
    return [SUI_COIN_TYPE, getEveCoinType(tenantId)];
  }
  return [...(DEFAULT_TOKENS_BY_CHAIN[chain] ?? [SUI_COIN_TYPE])];
}
