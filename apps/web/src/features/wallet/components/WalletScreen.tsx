import type { TenantId } from '@evefrontier/wallet-core/tenant'
import { HeaderMobile, LockScreen, NetworkSelector } from '@evevault/shared'
import { switchTenantAndReload, useAuth } from '@evevault/shared/auth'
import {
  Background,
  Button,
  Heading,
  TenantSelector,
  Text,
  TokenListSection,
} from '@evevault/shared/components'
import Icon from '@evevault/shared/components/Icon'
import {
  useContext,
  useDevice,
  useUnlockTimeRemaining,
} from '@evevault/shared/hooks'
import { getCurrentTenantId, getTenantLabel } from '@evevault/shared/stores'
import { createSuiClient, getFaucetUrlForChain } from '@evevault/shared/sui'
import { createLogger, getSuiscanUrl, WEB_ROUTES } from '@evevault/shared/utils'
import { zkSignAny } from '@evevault/shared/wallet'
import { Transaction } from '@mysten/sui/transactions'
import type { SuiChain } from '@mysten/wallet-standard'
import { SUI_TESTNET_CHAIN } from '@mysten/wallet-standard'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type { User } from 'oidc-client-ts'
import type { ReactNode } from 'react'
import React, { useCallback, useEffect, useState } from 'react'
import { APP_VERSION } from '@/lib/appVersion'

const log = createLogger()

/**
 * Builds, signs (zkLogin) and submits a no-op test transaction.
 * Returns `ok: false` when the network reports a failed transaction.
 */
const executeTestTransaction = async (
  user: User,
  suiClient: ReturnType<typeof createSuiClient>,
  getZkProof: Parameters<typeof zkSignAny>[2]['getZkProof'],
): Promise<{ ok: boolean; digest: string | null }> => {
  const tx = new Transaction()
  tx.setSender(user.profile?.sui_address as string)
  const txb = await tx.build({ client: suiClient })
  const { bytes, zkSignature } = await zkSignAny('TransactionData', txb, {
    user,
    getZkProof,
  })
  log.debug('zkSignature ready', { length: zkSignature.length })
  log.debug('Transaction block bytes ready', { length: bytes.length })
  const result = await suiClient.core.executeTransaction({
    transaction: new Uint8Array(txb),
    signatures: [zkSignature],
  })
  // @mysten/sui 2.x: discriminated union Transaction | FailedTransaction
  if ('$kind' in result && result.$kind === 'FailedTransaction') {
    log.error('Transaction execution failed', { result })
    return { ok: false, digest: null }
  }
  const digest = result.Transaction?.digest ?? null
  log.info('Transaction executed', { digest })
  return { ok: true, digest }
}

interface WalletDashboardState {
  user: User
  chain: SuiChain | undefined
  tenantId: TenantId
  devMode: boolean
  faucetUrl: string | null
  txDigest: string | null
  authError: ReactNode
  deviceError: ReactNode
}

interface WalletDashboardActions {
  onDevModeToggle: () => void
  onSignSubmitTx: () => void | Promise<void>
  onTransactions: () => void
  onAddToken: () => void
  onSendToken: (coinType: string) => void
}

/** Initializes auth + device stores on mount and reports init status. */
const useWalletInitialization = (initializeAuth: () => Promise<unknown>) => {
  const { chain: networkState } = useContext()
  const [initError, setInitError] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)

  useEffect(() => {
    const initializeStores = async () => {
      try {
        log.info('Initializing stores')
        await initializeAuth()

        log.debug('Network state after init', networkState)

        log.info('Stores initialized successfully')
        setIsInitializing(false)
      } catch (error) {
        log.error('Error initializing stores', error)
        setInitError(
          error instanceof Error ? error.message : 'Failed to initialize',
        )
        setIsInitializing(false)
      }
    }

    initializeStores()
  }, [initializeAuth, networkState])

  return { initError, isInitializing }
}

/** Signs + submits a test transaction and records the resulting digest. */
const useWalletTestTransaction = (params: {
  user: User | null | undefined
  maxEpoch: string | number | null | undefined
  ephemeralPublicKey: unknown
  suiClient: ReturnType<typeof createSuiClient>
  getZkProof: Parameters<typeof zkSignAny>[2]['getZkProof']
  queryClient: ReturnType<typeof useQueryClient>
}) => {
  const {
    user,
    maxEpoch,
    ephemeralPublicKey,
    suiClient,
    getZkProof,
    queryClient,
  } = params
  const [txDigest, setTxDigest] = useState<string | null>(null)

  const signAndSubmit = useCallback(async () => {
    if (!user || !maxEpoch) return
    if (!ephemeralPublicKey) {
      throw new Error('[Wallet Screen] Ephemeral public key not found')
    }
    const { ok, digest } = await executeTestTransaction(
      user,
      suiClient,
      getZkProof,
    )
    if (!ok) {
      setTxDigest(null)
      return
    }
    setTxDigest(digest)
    void Promise.all([
      queryClient.refetchQueries({ queryKey: ['coin-balance'] }),
      queryClient.refetchQueries({ queryKey: ['transactions'] }),
    ])
  }, [user, maxEpoch, ephemeralPublicKey, getZkProof, suiClient, queryClient])

  return { txDigest, signAndSubmit }
}

/** Branded app shell used by the loading / error / signed-out states. */
const WalletShell = ({
  children,
  footer,
}: {
  children: ReactNode
  footer?: ReactNode
}) => (
  <Background>
    <header className="app-shell__header">
      <Heading level={1} variant="bold">
        EVE Vault
      </Heading>
    </header>
    <main className="app-shell__content">{children}</main>
    {footer}
  </Background>
)

const WalletDashboard = ({
  wallet,
  actions,
}: {
  wallet: WalletDashboardState
  actions: WalletDashboardActions
}) => {
  const {
    user,
    chain,
    tenantId,
    devMode,
    faucetUrl,
    txDigest,
    authError,
    deviceError,
  } = wallet
  const address = user.profile?.sui_address as string
  // Defined chain (testnet fallback) so balance and token list use the same
  // network and we avoid cross-network transfer/balance errors
  const resolvedChain = chain ?? SUI_TESTNET_CHAIN
  // Dev-only: live countdown of the vault unlock window.
  const unlockRemainingLabel = useUnlockTimeRemaining(devMode) ?? undefined

  return (
    <div>
      <HeaderMobile
        address={address}
        email={user.profile?.email as string}
        onTransactionsClick={actions.onTransactions}
        showDevActions={devMode}
        onDevModeToggle={actions.onDevModeToggle}
        onSignSubmitTxClick={devMode ? actions.onSignSubmitTx : undefined}
        onFaucetTestSuiClick={
          devMode && faucetUrl
            ? () => window.open(faucetUrl, '_blank', 'noopener,noreferrer')
            : undefined
        }
        currentTenantId={devMode ? tenantId : undefined}
        onServerChange={(nextTenantId: TenantId) =>
          switchTenantAndReload(nextTenantId)
        }
        version={APP_VERSION}
        unlockRemainingLabel={unlockRemainingLabel}
      />
      <TokenListSection
        user={user}
        chain={resolvedChain}
        walletAddress={address}
        onAddToken={actions.onAddToken}
        onSendToken={actions.onSendToken}
      />
      {/* Network selector and test tx result */}
      <div className="justify-between pt-8 flex gap-4 flex-col sm:flex-row">
        <div className="flex justify-between items-center gap-2 w-full">
          <NetworkSelector
            chain={resolvedChain}
            onNetworkSwitchStart={(previousNetwork, targetNetwork) => {
              log.info('Network switch started', {
                previousNetwork,
                targetNetwork,
              })
            }}
          />
          <div className="dropdown-selector--inline">
            <div
              className="dropdown-selector__trigger"
              style={{ cursor: 'default' }}
            >
              <Icon name="Network" color="quantum" />
              <Text variant="label-medium" size="medium">
                {getTenantLabel(tenantId)}
              </Text>
            </div>
          </div>
        </div>
        <div>
          {txDigest && (
            <div>
              <Text>
                Tx digest:{' '}
                <a
                  href={chain ? getSuiscanUrl(chain, txDigest) : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--quantum)' }}
                >
                  {txDigest}
                </a>
              </Text>
            </div>
          )}
          {authError && <Text color="error">Error: {authError}</Text>}
          {deviceError && <Text color="error">Error: {deviceError}</Text>}
        </div>
      </div>
    </div>
  )
}

export const WalletScreen = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { devMode, setDevMode } = useContext()

  const {
    user,
    login,
    initialize: initializeAuth,
    error: authError,
    loading: authLoading,
  } = useAuth()
  const {
    isLocked,
    isPinSet,
    maxEpoch,
    ephemeralPublicKey,
    getZkProof,
    error: deviceError,
    loading: deviceLoading,
    unlock,
  } = useDevice()
  const { chain } = useContext()
  const faucetUrl = getFaucetUrlForChain(chain)
  const tenantId = getCurrentTenantId()

  // Create suiClient with useMemo to recreate when chain changes
  const suiClient = React.useMemo(() => {
    // Defined chain so balance/transactions always use the same network; avoids cross-network errors
    const currentChain = chain || SUI_TESTNET_CHAIN
    log.debug('Creating SuiClient for chain', { chain: currentChain })
    return createSuiClient(currentChain)
  }, [chain])

  const { initError, isInitializing } = useWalletInitialization(initializeAuth)
  const { txDigest, signAndSubmit: handleSignAndSubmitTx } =
    useWalletTestTransaction({
      user,
      maxEpoch,
      ephemeralPublicKey,
      suiClient,
      getZkProof,
      queryClient,
    })

  const handleDevModeToggle = useCallback(() => {
    setDevMode(!devMode)
  }, [devMode, setDevMode])

  const handleLogin = async () => {
    try {
      await login()
      log.info('Login successful')
    } catch (err) {
      log.error('Login error', err)
    }
  }

  // Loading / error shells share the same branded layout
  const shellContent =
    isInitializing || authLoading || deviceLoading ? (
      <Text>Loading...</Text>
    ) : initError ? (
      <>
        <Text color="error">Error: {initError}</Text>
        <Button onClick={() => window.location.reload()}>Reload</Button>
      </>
    ) : null
  if (shellContent) {
    return <WalletShell>{shellContent}</WalletShell>
  }

  // Unencrypted ephemeral key pair present → require unlock
  if (isLocked) {
    return (
      <LockScreen
        isPinSet={isPinSet}
        unlock={unlock}
        onResetComplete={() => {
          window.location.href = '/'
        }}
      />
    )
  }

  if (!user) {
    return (
      <WalletShell
        footer={<TenantSelector currentTenantId={tenantId} viewOnly={true} />}
      >
        <Button onClick={async () => handleLogin()}>Sign in</Button>
      </WalletShell>
    )
  }

  return (
    <WalletDashboard
      wallet={{
        user,
        chain,
        tenantId,
        devMode,
        faucetUrl,
        txDigest,
        authError,
        deviceError,
      }}
      actions={{
        onDevModeToggle: handleDevModeToggle,
        onSignSubmitTx: handleSignAndSubmitTx,
        onTransactions: () => navigate({ to: WEB_ROUTES.WALLET_TRANSACTIONS }),
        onAddToken: () => navigate({ to: WEB_ROUTES.WALLET_ADD_TOKEN }),
        onSendToken: (coinType) =>
          navigate({
            to: WEB_ROUTES.WALLET_SEND_TOKEN,
            search: { coinType },
          }),
      }}
    />
  )
}
