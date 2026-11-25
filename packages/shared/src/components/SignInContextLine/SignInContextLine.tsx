import type { SuiChain } from '@mysten/wallet-standard'
import { NetworkSelector } from '#/components/NetworkSelector'
import { TenantSelector } from '#/components/TenantSelector'
import { useContext } from '#/hooks'
import type { TenantSelectorProps } from '#/types'
import './SignInContextLine.css'

/**
 * The small "Server · Network" line shown under the sign-in and PIN actions, so
 * the user can see where they are signing in before they do.
 */
export function SignInContextLine({
  tenant,
  onLocalnetSelected,
}: {
  tenant: TenantSelectorProps
  onLocalnetSelected?: () => void | Promise<void>
}) {
  const { chain } = useContext()

  return (
    <div className="sign-in-context">
      <TenantSelector {...tenant} />
      <span className="sign-in-context__sep" aria-hidden="true">
        ·
      </span>
      <NetworkSelector
        chain={chain as SuiChain}
        onLocalnetSelected={onLocalnetSelected}
      />
    </div>
  )
}

export default SignInContextLine
