import type { TenantId } from '@evefrontier/wallet-core/tenant'
import type { SuiChain } from '@mysten/wallet-standard'
import { NetworkSelector } from '#/components/NetworkSelector'
import { TenantSelector } from '#/components/TenantSelector'
import type { NetworkSelectorProps } from '#/types'

/** Read-only server chip and network chip for a top bar; the network menu opens downward. */
export function ContextChips({
  tenantId,
  chain,
  onLocalnetSelected,
  onNetworkSwitchStart,
}: {
  tenantId: TenantId
  chain?: SuiChain
  onLocalnetSelected?: NetworkSelectorProps['onLocalnetSelected']
  onNetworkSwitchStart?: NetworkSelectorProps['onNetworkSwitchStart']
}) {
  return (
    <>
      <TenantSelector currentTenantId={tenantId} viewOnly />
      {chain && (
        <NetworkSelector
          chain={chain}
          compact
          menuPlacement="bottom"
          onLocalnetSelected={onLocalnetSelected}
          onNetworkSwitchStart={onNetworkSwitchStart}
        />
      )}
    </>
  )
}

export default ContextChips
