import {
  SUI_DEVNET_CHAIN,
  SUI_TESTNET_CHAIN,
  type SuiChain,
} from "@mysten/wallet-standard";
import { EVE_TESTNET_COIN_TYPE, SUI_COIN_TYPE } from "../utils/constants";

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

/** Default token coin types per chain (e.g. SUI + chain-specific tokens like EVE on testnet). */
export const DEFAULT_TOKENS_BY_CHAIN: Record<string, string[]> = {
  [SUI_DEVNET_CHAIN]: [SUI_COIN_TYPE],
  [SUI_TESTNET_CHAIN]: [SUI_COIN_TYPE, EVE_TESTNET_COIN_TYPE],
};

/**
 * Default token list for a chain. Returns a copy so callers can mutate if needed.
 */
export function getDefaultTokensForChain(chain: string): string[] {
  return [...(DEFAULT_TOKENS_BY_CHAIN[chain] ?? [SUI_COIN_TYPE])];
}
