import { getEveCoinType } from '@evefrontier/wallet-core/eve-token'
import type { TenantId } from '@evefrontier/wallet-core/tenant'
import { SUI_LOCALNET_CHAIN, type SuiChain } from '@mysten/wallet-standard'
import { useQuery } from '@tanstack/react-query'
import { createSuiGraphQLClient } from '#/sui/graphqlClient'
import { LOCAL_DEV, LOCAL_DEV_EVE_MVR_TYPE } from '#/utils/localDev'

/** True on a LOCAL_DEV build's localnet, where EVE moves with every genesis. */
export const isLocalDevEveChain = (chain: SuiChain | null) =>
  LOCAL_DEV && chain === SUI_LOCALNET_CHAIN

/**
 * The tenant's EVE coin type: wallet-core's, from its embedded MVR cache. On a
 * LOCAL_DEV build's localnet it is resolved by MVR name through the local
 * stack instead, and is null until resolved. Other builds never query, so the
 * hook needs no QueryClient there (upstream's tests render without one).
 */
export function useEveCoinType(
  chain: SuiChain | null,
  tenantId: TenantId,
): string | null {
  // LOCAL_DEV is fixed at build time, so the hooks below run on every render
  // of a LOCAL_DEV build and on none of any other.
  if (!LOCAL_DEV) return getEveCoinType(tenantId)
  const local = isLocalDevEveChain(chain)
  // biome-ignore lint/correctness/useHookAtTopLevel: LOCAL_DEV is a build-time constant
  const { data } = useQuery({
    queryKey: ['local-dev-eve-coin-type'],
    queryFn: async () => {
      const client = createSuiGraphQLClient(SUI_LOCALNET_CHAIN)
      const { type } = await client.core.mvr.resolveType({
        type: LOCAL_DEV_EVE_MVR_TYPE,
      })
      return type
    },
    enabled: local,
    staleTime: 1000 * 60,
  })
  return local ? (data ?? null) : getEveCoinType(tenantId)
}
