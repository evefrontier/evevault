import type { TenantId } from '@evefrontier/wallet-core/tenant'
import { isWeb } from '#/utils/environment'
import { isAvailableTenantId } from '#/utils/tenantConfig'
import { getCurrentContextTenantId, useContextStore } from './contextStore'

export function getCurrentTenantId(): TenantId {
  return getCurrentContextTenantId()
}

export async function setCurrentTenantId(id: TenantId): Promise<void> {
  await useContextStore.getState().setTenantId(id)
}

/**
 * If running in web and URL has ?tenant=<id>, updates store to that tenant and returns true.
 * Does not run tenant-switch flow; caller should do that when tenant actually changes.
 */
export async function applyTenantFromUrl(): Promise<{
  tenantId: TenantId
  changed: boolean
}> {
  const current = getCurrentTenantId()
  if (!isWeb() || typeof window === 'undefined') {
    return { tenantId: current, changed: false }
  }
  const params = new URLSearchParams(window.location.search)
  const fromUrl = params.get('tenant')
  if (!fromUrl || !isAvailableTenantId(fromUrl, true)) {
    return { tenantId: current, changed: false }
  }
  if (fromUrl === current) {
    return { tenantId: current, changed: false }
  }
  await setCurrentTenantId(fromUrl)
  return { tenantId: fromUrl, changed: true }
}

export const OAuthTenantSessionKey = 'evevault_oauth_tenant'
