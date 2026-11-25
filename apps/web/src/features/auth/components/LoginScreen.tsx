import type { TenantId } from '@evefrontier/wallet-core/tenant'
import { LockScreen, switchTenantAndReload } from '@evevault/shared'
import { redirectToFusionAuthLogout, useAuth } from '@evevault/shared/auth'
import { SignInView, Text } from '@evevault/shared/components'
import { useContext, useDevice } from '@evevault/shared/hooks'
import {
  getAvailableTenantIds,
  getCurrentTenantId,
} from '@evevault/shared/stores'
import { useSearch } from '@tanstack/react-router'
import { useMemo } from 'react'
import { APP_VERSION } from '@/lib/appVersion'

export const LoginScreen = () => {
  const { login, loading } = useAuth()
  const { isLocked, isPinSet, unlock } = useDevice()
  const { devMode, setDevMode } = useContext()
  const { sessionExpired } = useSearch({ from: '/' })

  const availableTenantIds = useMemo(
    () => getAvailableTenantIds(devMode),
    [devMode],
  )
  const currentTenantId = getCurrentTenantId()

  // First, check for unencrypted ephemeral key pair. After a lost-session
  // recovery there's no keypair behind the lock, so show the sign-in notice
  // instead of a dead-end lock screen.
  if (isLocked && !sessionExpired) {
    return (
      <LockScreen
        isPinSet={isPinSet}
        unlock={unlock}
        version={APP_VERSION}
        onResetComplete={() => redirectToFusionAuthLogout()}
      />
    )
  }

  return (
    <SignInView
      loading={loading}
      onLogin={() => login()}
      tenant={{
        currentTenantId: currentTenantId as TenantId,
        availableTenantIds,
        onServerChange: (tenantId) =>
          switchTenantAndReload(tenantId as TenantId),
      }}
      devMode={devMode}
      onDevModeToggle={() => setDevMode(!devMode)}
      notice={
        sessionExpired && (
          <Text variant="light" color="n60">
            For your security, this browser cleared your local session. Sign in
            again to continue.
          </Text>
        )
      }
    />
  )
}
