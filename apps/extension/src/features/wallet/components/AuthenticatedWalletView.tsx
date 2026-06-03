import type { TenantId } from '@evefrontier/wallet-core/definitions'
import {
  HeaderMobile,
  NetworkSelector,
  TenantSelector,
  Text,
  TokenListSection,
} from '@evevault/shared/components'
import { getSuiscanUrl } from '@evevault/shared/utils'
import type { SuiChain } from '@mysten/wallet-standard'
import type { User } from 'oidc-client-ts'
import { APP_VERSION } from '@/lib/appVersion'

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
  onTransactionsClick,
  onLocalnetSettingsClick,
  onAddToken,
  onSendToken,
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
  onTransactionsClick: () => void
  onLocalnetSettingsClick: () => void
  onAddToken: () => void
  onSendToken: (coinType: string) => void
  onLocalnetSelected: () => Promise<void>
  onNetworkSwitchStart: (previousNetwork: string, targetNetwork: string) => void
}) {
  const openFaucet = faucetUrl
    ? () => window.open(faucetUrl, '_blank', 'noopener,noreferrer')
    : undefined

  return (
    <div className="flex flex-col h-full">
      <HeaderMobile
        address={activeAddress ?? ''}
        email={user.profile?.email ?? ''}
        onTransactionsClick={onTransactionsClick}
        showDevActions={devMode}
        onDevModeToggle={onDevModeToggle}
        onSignSubmitTxClick={devMode ? onTestTransaction : undefined}
        onRotateEphKeyClick={devMode ? onRotateEphKey : undefined}
        onFaucetTestSuiClick={devMode ? openFaucet : undefined}
        onLocalnetSettingsClick={devMode ? onLocalnetSettingsClick : undefined}
        version={APP_VERSION}
      />

      <TokenListSection
        user={user}
        chain={chain || null}
        walletAddress={activeAddress ?? ''}
        balanceAddress={activeAddress}
        localnetUrl={localnetUrl}
        onAddToken={onAddToken}
        onSendToken={onSendToken}
      />

      <div className="justify-between flex items-center gap-4">
        <NetworkSelector
          chain={chain}
          onLocalnetSelected={onLocalnetSelected}
          onNetworkSwitchStart={onNetworkSwitchStart}
        />

        <TenantSelector currentTenantId={tenantId} viewOnly={true} />
      </div>

      {authError && <Text color="error">AuthError: {authError}</Text>}
      {deviceError && <Text color="error">DeviceError: {deviceError}</Text>}
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
