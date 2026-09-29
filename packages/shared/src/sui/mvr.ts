import { getMvrCache } from '@evefrontier/wallet-core/tenant'
import type { SuiClientTypes } from '@mysten/sui/client'
import { normalizeStructTag } from '@mysten/sui/utils'
import type { SuiChain } from '@mysten/wallet-standard'

type MvrNetwork = 'mainnet' | 'testnet'

const isMvrNetwork = (network: string): network is MvrNetwork =>
  network === 'mainnet' || network === 'testnet'

const toNetwork = (chain: SuiChain) => chain.replace('sui:', '')

/**
 * Client `mvr` options that pre-resolve `@evefrontier/*` names from
 * wallet-core's embedded cache. Returns an empty object for networks
 * without a cache so callers can spread it unconditionally.
 */
export const getMvrClientOptions = (
  network: string,
): { mvr?: SuiClientTypes.MvrOptions } =>
  isMvrNetwork(network) ? { mvr: { overrides: getMvrCache(network) } } : {}

const typeNamesByNetwork = new Map<MvrNetwork, Map<string, string>>()

// Reverse of the cache's `types` map, keyed by normalized struct tag.
const getTypeNames = (network: MvrNetwork): Map<string, string> => {
  let names = typeNamesByNetwork.get(network)
  if (!names) {
    const types: Record<string, string> = getMvrCache(network).types
    names = new Map(
      Object.entries(types).map(([name, tag]) => [
        normalizeStructTag(tag),
        name,
      ]),
    )
    typeNamesByNetwork.set(network, names)
  }
  return names
}

/**
 * MVR name for a fully-qualified type (e.g. `@evefrontier/currency::EVE::EVE`),
 * or null when the type is not in wallet-core's cache for the chain.
 */
export const getMvrTypeName = (
  type: string,
  chain: SuiChain | null,
): string | null => {
  if (!chain) return null
  const network = toNetwork(chain)
  if (!isMvrNetwork(network)) return null
  try {
    return getTypeNames(network).get(normalizeStructTag(type)) ?? null
  } catch {
    return null
  }
}
