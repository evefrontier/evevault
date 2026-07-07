import type { SuiChain } from '@mysten/wallet-standard'
import { User } from 'oidc-client-ts'
import { userToJwtResponse } from '#/auth/userToJwtResponse'
import { resolveExpiresAt } from '#/auth/utils/authStoreUtils'
import { useDeviceStore } from '#/stores'
import { getCurrentTenantId, OAuthTenantSessionKey } from '#/stores/tenantStore'
import { isZkLoginSuiChain, type ZkLoginSuiChain } from '#/types/networks'
import { createLogger } from '#/utils'
import { persistEnrichedUser } from './authUserSession'
import {
  type AuthSet,
  type GetUserManagerInstance,
  getErrorMessage,
} from './authWorkflowUtils'

const log = createLogger()

export async function initializeWebSession(
  getUserManagerInstance: GetUserManagerInstance,
  network: SuiChain,
): Promise<User | null> {
  /*
   * Web sessions are owned by oidc-client-ts storage. If the token is expired,
   * use silent renew only when a refresh token is present; otherwise return a
   * clean null user so callers can render the logged-out state.
   */
  const webUserManager = getUserManagerInstance()
  let webUser = await webUserManager.getUser()

  const webJwt = userToJwtResponse(webUser)
  const now = Math.floor(Date.now() / 1000)
  const isExpired = !webJwt || now >= resolveExpiresAt(webJwt)

  if (!isExpired) {
    if (!webUser) return null
    // Salt is stripped from sessionStorage for security. The user is loaded
    // from storage without salt, so it is re-derived via the Api Gateway before returning
    // so the in-memory auth store is always fully enriched for signing.
    const hasSalt =
      typeof (webUser.profile as Record<string, unknown>)?.salt === 'string'
    if (!hasSalt) return persistEnrichedUser(new User(webUser), webUserManager)
    return webUser
  }

  if (!webUser?.refresh_token?.trim()) {
    log.info('Web init: no session or refresh token, not logged in', {
      network,
    })
    return null
  }

  try {
    webUser = await webUserManager.signinSilent()

    if (!webUser) {
      return null
    }

    return persistEnrichedUser(new User(webUser), webUserManager)
  } catch (error) {
    log.warn('Web init: silent renew failed, not logged in', {
      network,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

async function ensureDeviceDataForLogin(
  network: ZkLoginSuiChain,
): Promise<void> {
  /*
   * OAuth redirect returns to a vendJwt flow that requires a valid nonce and max
   * epoch for the selected zkLogin network. Prepare that device data before
   * leaving the app.
   */
  const deviceStore = useDeviceStore.getState()
  const networkData = deviceStore.networkData[network]
  const isExpired =
    networkData?.maxEpochTimestampMs != null &&
    Date.now() >= networkData.maxEpochTimestampMs

  if (networkData?.nonce && networkData?.maxEpoch && !isExpired) {
    return
  }

  log.info('Initializing device data for network before login', { network })
  await deviceStore.initializeForChain(network)
}

export async function loginWebSession(
  set: AuthSet,
  getUserManagerInstance: GetUserManagerInstance,
  network: SuiChain,
): Promise<void> {
  // Localnet bypasses zkLogin OAuth, so there is no web redirect to start.
  if (!isZkLoginSuiChain(network)) {
    log.info('Skipping OAuth redirect for non-zkLogin network', { network })
    set({ loading: false })
    return
  }

  try {
    await ensureDeviceDataForLogin(network)

    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(OAuthTenantSessionKey, getCurrentTenantId())
    }

    getUserManagerInstance().signinRedirect()
    set({ loading: false })
  } catch (error) {
    log.error('Login failed (web)', error)
    set({ loading: false, error: getErrorMessage(error) })
  }
}
