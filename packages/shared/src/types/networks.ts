import {
  SUI_DEVNET_CHAIN,
  SUI_TESTNET_CHAIN,
  type SuiChain,
} from "@mysten/wallet-standard";

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
