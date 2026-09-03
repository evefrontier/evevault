import './PopupApp.css'
import type { TenantId } from '@evefrontier/wallet-core/tenant'
import {
  getAvailableTenantIds,
  getCurrentTenantId,
  switchTenantAndReload,
} from '@evevault/shared'
import {
  redirectToFusionAuthLogout,
  resetVaultOnDevice,
  useAuth,
} from '@evevault/shared/auth'
import { Button, Heading, Text } from '@evevault/shared/components'
import {
  useContext,
  useDevice,
  useDevMode,
  useVaultAutoLock,
} from '@evevault/shared/hooks'
import { LockScreen } from '@evevault/shared/screens'
import { localnetKeyService } from '@evevault/shared/services/vaultService'
import { getFaucetUrlForChain } from '@evevault/shared/sui'
import { createLogger, EXTENSION_ROUTES } from '@evevault/shared/utils'
import { useActiveSuiAddress, useBalance } from '@evevault/shared/wallet'
import { useNavigate } from '@tanstack/react-router'
import { type ReactNode, useCallback, useMemo } from 'react'
import { useAppInitialization, useLogin } from '@/features/wallet/hooks'
import { AuthenticatedWalletView } from './AuthenticatedWalletView'
import { UnauthenticatedView } from './UnauthenticatedView'

const log = createLogger()

/**
 * Shares the logo-centered shell between initialization states so loading and
 * error screens keep identical popup spacing.
 */
function SplashView({
  title,
  children,
}: {
  title: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-between gap-4 w-full h-full">
      <section className="flex flex-col items-center gap-10 w-full flex-1">
        <img src="/images/logo.png" alt="EVE Vault" className="h-20 w-auto" />
        <header className="flex flex-col items-center gap-4 text-center">
          <Heading level={2}>{title}</Heading>
          {children}
        </header>
      </section>
    </div>
  )
}

/**
 * Renders the initialization progress copy separately from the shell to keep
 * the root component branch small.
 */
function LoadingView() {
  return (
    <SplashView title="Loading...">
      <Text variant="light" size="large">
        Preparing your wallet
      </Text>
    </SplashView>
  )
}

/**
 * Keeps reload handling local to the initialization error state because other
 * popup errors should not force a full extension page reload.
 */
function InitErrorView({ initError }: { initError: string }) {
  return (
    <SplashView title="Error">
      <Text color="error">Error: {initError}</Text>
      <div className="w-full max-w-75">
        <Button size="fill" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    </SplashView>
  )
}

function App() {
  const navigate = useNavigate()
  const { initError, isInitializing } = useAppInitialization()
  const { chain, devMode, setDevMode } = useContext()
  const { user, loading: authLoading, error: authError } = useAuth()
  const {
    isLocked,
    isPinSet,
    error: deviceError,
    unlock,
    localnetUrl,
  } = useDevice()
  const faucetUrl = getFaucetUrlForChain(chain)
  useVaultAutoLock()
  const { handleLogin } = useLogin()
  const { handleTestTransaction, txDigest, handleRotateEphKey } = useDevMode()
  const activeAddress = useActiveSuiAddress()

  // Use TanStack Query for balance fetching
  useBalance({
    user: user || null,
    chain: chain || null,
    address: activeAddress, // localnet address or zkLogin address
    localnetUrl,
  })

  const availableTenantIds = useMemo(
    () => getAvailableTenantIds(devMode),
    [devMode],
  )
  const tenantId = getCurrentTenantId()

  const handleDevModeToggle = useCallback(() => {
    setDevMode(!devMode)
  }, [devMode, setDevMode])

  const onLoginClick = async () => {
    await handleLogin()
  }

  // Show loading state while initializing
  if (isInitializing) {
    return <LoadingView />
  }

  if (initError) {
    return <InitErrorView initError={initError} />
  }

  if (isLocked) {
    return (
      <LockScreen
        isPinSet={isPinSet}
        unlock={unlock}
        onResetComplete={() => {
          redirectToFusionAuthLogout()
          navigate({ to: '/' })
        }}
      />
    )
  }

  if (!user) {
    return (
      <UnauthenticatedView
        authLoading={authLoading}
        availableTenantIds={availableTenantIds}
        tenantId={tenantId}
        isPinSet={isPinSet}
        devMode={devMode}
        onLoginClick={onLoginClick}
        onTenantChange={(tenantId) =>
          switchTenantAndReload(tenantId as TenantId)
        }
        onResetVault={async () => {
          try {
            await resetVaultOnDevice()
            navigate({ to: '/' })
          } catch (error) {
            log.error('Failed to reset vault', error)
          }
        }}
        onDevModeToggle={handleDevModeToggle}
      />
    )
  }

  return (
    <AuthenticatedWalletView
      user={user}
      chain={chain}
      activeAddress={activeAddress}
      localnetUrl={localnetUrl}
      tenantId={tenantId}
      devMode={devMode}
      faucetUrl={faucetUrl}
      authError={authError}
      deviceError={deviceError}
      txDigest={txDigest}
      onDevModeToggle={handleDevModeToggle}
      onTestTransaction={handleTestTransaction}
      onRotateEphKey={handleRotateEphKey}
      onLocalnetSelected={async () => {
        const addr = await localnetKeyService.getAddress().catch(() => null)
        if (!addr) {
          log.info('No localnet keypair found, navigating to settings page')
          navigate({ to: EXTENSION_ROUTES.LOCALNET_SETTINGS })
        }
      }}
      onNetworkSwitchStart={(previousNetwork, targetNetwork) => {
        log.info('Network switch started', {
          previousNetwork,
          targetNetwork,
        })
      }}
    />
  )
}

export default App
