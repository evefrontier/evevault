import { getEveCoinType } from '@evefrontier/wallet-core/eve-token'
import { TenantId } from '@evefrontier/wallet-core/tenant'
import {
  SUI_DEVNET_CHAIN,
  SUI_LOCALNET_CHAIN,
  SUI_MAINNET_CHAIN,
  SUI_TESTNET_CHAIN,
  type SuiChain,
} from '@mysten/wallet-standard'
import { SUI_COIN_TYPE } from '#/utils/constants'

export function isLocalnetChain(chain: SuiChain | string | null | undefined) {
  return chain === SUI_LOCALNET_CHAIN
}

export function isZkLoginChain(chain: SuiChain | string | null | undefined) {
  return !!chain && !isLocalnetChain(chain)
}

export type ZkLoginSuiChain =
  | typeof SUI_DEVNET_CHAIN
  | typeof SUI_TESTNET_CHAIN
  | typeof SUI_MAINNET_CHAIN

export function isZkLoginSuiChain(
  chain: SuiChain | string | null | undefined,
): chain is ZkLoginSuiChain {
  return (
    chain === SUI_DEVNET_CHAIN ||
    chain === SUI_TESTNET_CHAIN ||
    chain === SUI_MAINNET_CHAIN
  )
}

export interface NetworkOption {
  chain: SuiChain
  label: string
  shortLabel: string
}

export const AVAILABLE_NETWORKS: NetworkOption[] = [
  { chain: SUI_TESTNET_CHAIN, label: 'Testnet', shortLabel: 'TEST' },
  { chain: SUI_DEVNET_CHAIN, label: 'Devnet', shortLabel: 'DEV' },
  // Mainnet will be added later as a feature flag
]

/**
 * Returns the network list for the selector.
 * Localnet is appended only when dev mode is enabled AND running in extension context,
 * since localnet signing bypasses zkLogin and is not appropriate for the web app.
 */
export function getAvailableNetworks(
  devMode: boolean,
  isExt: boolean,
): NetworkOption[] {
  if (devMode && isExt) {
    return [
      ...AVAILABLE_NETWORKS,
      { chain: SUI_LOCALNET_CHAIN, label: 'Localnet', shortLabel: 'LOCAL' },
    ]
  }
  return AVAILABLE_NETWORKS
}

/**
 * Get the display label for a given SuiChain
 * @param chain - The SuiChain to get the label for
 * @returns The display label, or the chain string if not found
 */
export function getNetworkLabel(chain: SuiChain): string {
  return AVAILABLE_NETWORKS.find((n) => n.chain === chain)?.label ?? chain
}

/**
 * Get the full network option for a given SuiChain
 * @param chain - The SuiChain to get the option for
 * @returns The NetworkOption if found, undefined otherwise
 */
export function getNetworkOption(chain: SuiChain): NetworkOption | undefined {
  return AVAILABLE_NETWORKS.find((n) => n.chain === chain)
}

/** Default token coin types per chain (e.g. SUI + chain-specific tokens like EVE on testnet). Testnet uses stillness tenant's EVE package for static default. */
export const DEFAULT_TOKENS_BY_CHAIN: Record<string, string[]> = {
  [SUI_TESTNET_CHAIN]: [SUI_COIN_TYPE, getEveCoinType(TenantId.STILLNESS)],
  [SUI_DEVNET_CHAIN]: [SUI_COIN_TYPE],
}

/**
 * Default token list for a chain. Returns a copy so callers can mutate if needed.
 * For testnet, pass tenantId to use that tenant's EVE coin type; otherwise uses DEFAULT_TOKENS_BY_CHAIN (stillness).
 */
export function getDefaultTokensForChain(
  chain: string,
  tenantId?: TenantId,
): string[] {
  if (chain === SUI_TESTNET_CHAIN && tenantId !== undefined) {
    return [SUI_COIN_TYPE, getEveCoinType(tenantId)]
  }
  return [...(DEFAULT_TOKENS_BY_CHAIN[chain] ?? [SUI_COIN_TYPE])]
}
