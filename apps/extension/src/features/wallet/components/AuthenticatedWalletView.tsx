import type { TenantId } from '@evefrontier/wallet-core/tenant'
import {
  HeaderMobile,
  NetworkSelector,
  TenantSelector,
  Text,
  TokenListSection,
  useToast,
} from '@evevault/shared/components'
import { useUnlockTimeRemaining } from '@evevault/shared/hooks'
import { EXTENSION_ROUTES, getSuiscanUrl } from '@evevault/shared/utils'
import type { SuiChain } from '@mysten/wallet-standard'
import { useNavigate } from '@tanstack/react-router'
import type { User } from 'oidc-client-ts'
import { useEffect } from 'react'
import { APP_VERSION } from '@/lib/appVersion'

/**
 * Builds the explorer URL at render time so localnet transactions use the
 * currently configured RPC URL when available.
 */
function TransactionDigestLink({
  chain,
  txDigest,
  localnetUrl,
}: {
  chain: SuiChain
  txDigest: string
  localnetUrl?: string
}) {
  const href = getSuiscanUrl(chain, txDigest, {
    localnetUrl,
  })

  return (
    <Text>
      Transaction digest:{' '}
      <a href={href} target="_blank" rel="noopener noreferrer">
        {txDigest}
      </a>
    </Text>
  )
}

/**
 * Keeps the authenticated popup shell focused on wiring wallet actions while
 * PopupApp owns auth, initialization, and routing decisions.
 */
export function AuthenticatedWalletView({
  user,
  chain,
  activeAddress,
  localnetUrl,
  tenantId,
  devMode,
  faucetUrl,
  authError,
  deviceError,
  txDigest,
  onDevModeToggle,
  onTestTransaction,
  onRotateEphKey,
  onLocalnetSelected,
  onNetworkSwitchStart,
}: {
  user: User
  chain: SuiChain
  activeAddress: string | null | undefined
  localnetUrl?: string
  tenantId: TenantId
  devMode: boolean
  faucetUrl?: string | null
  authError: string | null
  deviceError: string | null
  txDigest: string | null
  onDevModeToggle: () => void
  onTestTransaction: () => void
  onRotateEphKey: () => void
  onLocalnetSelected: () => Promise<void>
  onNetworkSwitchStart: (previousNetwork: string, targetNetwork: string) => void
}) {
  const navigate = useNavigate()
  const { showErrorToast } = useToast()
  const openFaucet = faucetUrl
    ? () => window.open(faucetUrl, '_blank', 'noopener,noreferrer')
    : undefined
  // Display only of the vault unlock window.
  const unlockRemainingLabel = useUnlockTimeRemaining(devMode) ?? undefined

  useEffect(() => {
    if (authError) showErrorToast('AuthError', authError)
  }, [authError, showErrorToast])

  useEffect(() => {
    if (deviceError) showErrorToast('DeviceError', deviceError)
  }, [deviceError, showErrorToast])

  return (
    <div className="flex flex-col h-full">
      <HeaderMobile
        address={activeAddress ?? ''}
        email={user.profile?.email ?? ''}
        onTransactionsClick={() =>
          navigate({ to: EXTENSION_ROUTES.TRANSACTIONS })
        }
        onAddressAliasesClick={() =>
          navigate({ to: EXTENSION_ROUTES.ADDRESS_ALIASES })
        }
        showDevActions={devMode}
        onDevModeToggle={onDevModeToggle}
        onSignSubmitTxClick={devMode ? onTestTransaction : undefined}
        onRotateEphKeyClick={devMode ? onRotateEphKey : undefined}
        onFaucetTestSuiClick={devMode ? openFaucet : undefined}
        onLocalnetSettingsClick={
          devMode
            ? () => navigate({ to: EXTENSION_ROUTES.LOCALNET_SETTINGS })
            : undefined
        }
        version={APP_VERSION}
        unlockRemainingLabel={unlockRemainingLabel}
      />

      <TokenListSection
        user={user}
        chain={chain}
        walletAddress={activeAddress ?? ''}
        balanceAddress={activeAddress}
        localnetUrl={localnetUrl}
        onAddToken={() => navigate({ to: '/add-token' })}
        onSendToken={(coinType) =>
          navigate({ to: '/send-token', search: { coinType } })
        }
      />

      <div className="justify-between flex items-center gap-4">
        <NetworkSelector
          chain={chain}
          onLocalnetSelected={onLocalnetSelected}
          onNetworkSwitchStart={onNetworkSwitchStart}
        />

        <TenantSelector currentTenantId={tenantId} viewOnly={true} />
      </div>

      {txDigest && (
        <TransactionDigestLink
          chain={chain}
          txDigest={txDigest}
          localnetUrl={localnetUrl}
        />
      )}
    </div>
  )
}
