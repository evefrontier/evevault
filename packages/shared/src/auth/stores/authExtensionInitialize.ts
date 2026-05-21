import type { SuiChain } from '@mysten/wallet-standard'
import type { User } from 'oidc-client-ts'
import { getJwt } from '#/auth/storageService'
import { createLogger } from '#/utils'
import {
  buildUserFromJwt,
  jwtTiming,
  persistEnrichedUser,
} from './authUserSession'
import type { GetUserManagerInstance } from './authWorkflowUtils'

const log = createLogger()

async function rebuildExtensionUserFromStoredJwt(
  network: SuiChain,
): Promise<User | null> {
  /*
   * The background dapp-login path stores tokens but does not always create an
   * OIDC UserManager session. Rebuild that session so the popup can initialize
   * as logged in after the service worker wakes up.
   */
  const storedJwt = await getJwt()

  if (!storedJwt?.id_token) {
    log.info('Extension init: no OIDC user or stored JWT, clearing auth', {
      network,
    })
    return null
  }

  log.info(
    'Extension init: no OIDC user in UserManager, rebuilding from stored JWT',
    { network },
  )
  return buildUserFromJwt(storedJwt)
}

async function refreshExtensionUserIfExpired(
  user: User,
  getUserManagerInstance: GetUserManagerInstance,
  network: SuiChain,
): Promise<User | null> {
  const timing = jwtTiming(user)

  if (!timing || timing.now < timing.expiresAt) {
    return user
  }

  if (!user.refresh_token?.trim()) {
    log.info('Extension init: JWT expired, no refresh token; clearing user', {
      network,
      expiresAt: timing.expiresAt,
      now: timing.now,
    })
    return null
  }

  log.info('[Extension init] JWT expired, attempting silent renew', {
    network,
    expiresAt: timing.expiresAt,
    now: timing.now,
  })

  const userManager = getUserManagerInstance()
  // signinSilent needs the current user persisted so it can find refresh_token.
  await userManager.storeUser(user)

  try {
    const refreshedUser = await userManager.signinSilent()
    return validRefreshedExtensionUser(refreshedUser, network)
  } catch (error) {
    log.error('[Extension init] OIDC silent renew failed', {
      network,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

function validRefreshedExtensionUser(
  refreshedUser: User | null,
  network: SuiChain,
): User | null {
  if (!refreshedUser?.id_token) {
    log.info('[Extension init] silent renew returned no user session', {
      network,
    })
    return null
  }

  const refreshedTiming = jwtTiming(refreshedUser)
  if (refreshedTiming && refreshedTiming.now >= refreshedTiming.expiresAt) {
    log.info('[Extension init] JWT still expired after silent renew', {
      network,
    })
    return null
  }

  return refreshedUser
}

export async function initializeExtensionSession(
  getUserManagerInstance: GetUserManagerInstance,
  network: SuiChain,
): Promise<User | null> {
  /*
   * Extension initialization prefers the OIDC session, falls back to the stored
   * primary JWT, refreshes if needed, then re-persists the enriched session.
   */
  let user = await getUserManagerInstance().getUser()

  if (!user?.id_token) {
    user = await rebuildExtensionUserFromStoredJwt(network)
  }

  if (!user) {
    return null
  }

  const refreshedUser = await refreshExtensionUserIfExpired(
    user,
    getUserManagerInstance,
    network,
  )

  if (!refreshedUser) {
    return null
  }

  return persistEnrichedUser(refreshedUser, getUserManagerInstance())
}
