import type { TenantId } from '@evefrontier/dapp-kit/utils'
import { clearZkLoginAddressCache } from '#/auth/getZkLoginAddress'
import { clearAllJwts } from '#/auth/storageService'
import { zkProofService } from '#/services/vaultService'
import { useDeviceStore } from '#/stores'
import { getCurrentTenantId } from '#/stores/tenantStore'
import { performFullCleanup } from '#/utils'
import { getTenantConfig } from '#/utils/tenantConfig'
import {
  getExtensionLogoutRedirectUri,
  launchExtensionLogout,
} from './authExtensionWorkflows'
import type { AuthSet, GetUserManagerInstance } from './authWorkflowUtils'

export async function clearAuthSession(
  set: AuthSet,
  getUserManagerInstance: GetUserManagerInstance,
): Promise<void> {
  /*
   * Logout clears identity, cached JWTs, zkLogin address/proof data, and locks
   * device state. Device keys remain persisted; users can unlock again later.
   */
  await getUserManagerInstance().removeUser()
  await performFullCleanup()
  await clearAllJwts()
  clearZkLoginAddressCache()
  set({ user: null })
  await zkProofService.clear()
  await useDeviceStore.getState().lock()
}

function buildLogoutUrl(tenant: TenantId, redirectUri: string): string {
  // Construct directly to avoid relying on OIDC discovery during logout.
  const tenantConfig = getTenantConfig(tenant)
  const logoutUrl = new URL(
    `${tenantConfig.serverUrl.replace(/\/$/, '')}/oauth2/logout`,
  )
  logoutUrl.searchParams.set('client_id', tenantConfig.clientId)
  logoutUrl.searchParams.set('post_logout_redirect_uri', redirectUri)
  return logoutUrl.toString()
}

export function finishExtensionLogout(): void {
  const logoutUrl = buildLogoutUrl(
    getCurrentTenantId(),
    getExtensionLogoutRedirectUri(),
  )
  launchExtensionLogout(logoutUrl)
}
