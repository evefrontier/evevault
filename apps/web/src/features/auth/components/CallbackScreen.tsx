import { getCurrentTenantId, OAuthTenantSessionKey } from '@evevault/shared'
import {
  getUserManager,
  getZkLoginAddress,
  useAuthStore,
} from '@evevault/shared/auth'
import { Heading, Text } from '@evevault/shared/components'
import type { RoutePath } from '@evevault/shared/types'
import {
  createLogger,
  getDevModeEnabled,
  isAvailableTenantId,
  SESSION_STORAGE_REDIRECT_KEY,
} from '@evevault/shared/utils'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { User } from 'oidc-client-ts'
import { type ReactNode, useEffect, useState } from 'react'
import { isRoutePath } from '@/lib/routeUtils'

const log = createLogger()

const FALLBACK_ROUTE: RoutePath = '/wallet'

/** Guard so the OAuth code is only exchanged once (avoids "Invalid Authorization Code" from double-run in Strict Mode or reload). */
let callbackExchangeStarted = false

/**
 * Exchanges the OAuth code, attaches the zkLogin address to the stored user,
 * and resolves to the route the caller should navigate to. Throws on failure.
 */
const completeOAuthCallback = async (): Promise<RoutePath> => {
  const redirectAfterLogin = sessionStorage.getItem(
    SESSION_STORAGE_REDIRECT_KEY,
  )
  sessionStorage.removeItem(SESSION_STORAGE_REDIRECT_KEY)
  const tenantId =
    sessionStorage.getItem(OAuthTenantSessionKey) ?? getCurrentTenantId()
  sessionStorage.removeItem(OAuthTenantSessionKey)
  const redirectTo = redirectAfterLogin || FALLBACK_ROUTE

  const devMode = await getDevModeEnabled()
  // Use oidc-client-ts's built-in PKCE support for the tenant we started login with
  if (!isAvailableTenantId(tenantId, devMode)) {
    throw new Error(`Invalid tenant id: ${tenantId}`)
  }
  const userManager = getUserManager(tenantId)
  const user = await userManager.signinRedirectCallback()

  if (!user?.id_token) {
    throw new Error('Failed to authenticate')
  }

  // Get zkLogin address
  const { salt, address } = await getZkLoginAddress({
    jwt: user.id_token,
  })

  // Update user profile with zkLogin address.
  // salt is kept in-memory (Zustand) for signing but stripped from sessionStorage
  // so it never sits in browser-accessible storage.
  const updatedUser = new User({
    ...user,
    profile: { ...user.profile, sui_address: address, salt },
  })

  const { salt: _s, ...profileWithoutSalt } = updatedUser.profile as Record<
    string,
    unknown
  >
  await userManager.storeUser(
    new User({
      ...updatedUser,
      profile: profileWithoutSalt as User['profile'],
    }),
  )
  useAuthStore.getState().setUser(updatedUser)

  log.info('FusionAuth callback successful')
  return isRoutePath(redirectTo) ? redirectTo : FALLBACK_ROUTE
}

/** Shared centered layout for both the loading and error states. */
const CallbackLayout = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-col items-center justify-between gap-4 w-full h-full">
    <section className="flex flex-col items-center gap-10 w-full flex-1">
      <img src="/images/logo.png" alt="EVE Vault" className="h-20 w-auto" />
      <header className="flex flex-col items-center gap-4 text-center">
        {children}
      </header>
    </section>
  </div>
)

export const CallbackScreen = () => {
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const _search = useSearch({ from: '/callback' })

  useEffect(() => {
    if (callbackExchangeStarted) {
      return
    }
    callbackExchangeStarted = true

    completeOAuthCallback()
      .then((destination) => navigate({ to: destination }))
      .catch((err) => {
        log.error('OAuth callback error', err)
        setError(err instanceof Error ? err.message : 'Authentication failed')
        setTimeout(() => {
          navigate({ to: '/' })
        }, 3000)
      })
      .finally(() => {
        callbackExchangeStarted = false
      })
  }, [navigate])

  if (error) {
    return (
      <CallbackLayout>
        <Heading level={2}>Authentication Error</Heading>
        <Text color="error">{error}</Text>
        <Text>Redirecting to login...</Text>
      </CallbackLayout>
    )
  }

  return (
    <CallbackLayout>
      <Heading level={2}>Completing authentication...</Heading>
      <Text variant="light" size="large">
        Please wait while we finish signing you in.
      </Text>
    </CallbackLayout>
  )
}
