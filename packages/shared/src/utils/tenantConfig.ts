import { TenantId } from '@evefrontier/wallet-core/tenant'
import type { TenantConfig } from '#/types'
import { TENANT_KEYS } from './constants'
import { isWeb } from './environment'

export const DEFAULT_TENANT_ID = TenantId.STILLNESS

const KNOWN_TENANT_IDS: TenantId[] = Object.keys(TENANT_KEYS) as TenantId[]

function normalizeOrigin(url: string): string {
  return url.replace(/\/$/, '')
}

function isWebProduction(): boolean {
  if (!isWeb()) return false
  const nodeEnv =
    typeof globalThis !== 'undefined' &&
    (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
      ?.NODE_ENV
  const importMetaMode =
    typeof import.meta !== 'undefined' &&
    (import.meta as { env?: { MODE?: string } }).env?.MODE
  const mode = nodeEnv ?? importMetaMode
  return mode === 'production'
}

/** True when the web app is running on the tenant's own site (e.g. the PTU site). */
function isServedFromCurrentOrigin(tenantId: TenantId): boolean {
  if (!isWeb() || typeof window === 'undefined') return false
  return (
    normalizeOrigin(TENANT_KEYS[tenantId].webOrigin) ===
    normalizeOrigin(window.location.origin)
  )
}

/**
 * Returns FusionAuth client config for the given tenant.
 */
export function getTenantConfig(tenantId: TenantId): TenantConfig {
  return TENANT_KEYS[tenantId] ?? TENANT_KEYS[DEFAULT_TENANT_ID]
}

export function getDefaultTenantId(): TenantId {
  return DEFAULT_TENANT_ID
}

/**
 * Returns available tenant ids. The default tenant is always listed. Other tenants
 * are listed when devMode is true, or when they are not dev-only (isDev) and the
 * web app is running on their webOrigin. In web production mode all tenants
 * (including the default) are then filtered to those whose webOrigin matches
 * window.location.origin.
 */
export function getAvailableTenantIds(devMode = false): TenantId[] {
  const ids: TenantId[] = [DEFAULT_TENANT_ID]

  for (const id of KNOWN_TENANT_IDS) {
    if (id === DEFAULT_TENANT_ID) continue
    if (!devMode && (TENANT_KEYS[id].isDev || !isServedFromCurrentOrigin(id)))
      continue
    ids.push(id)
  }

  if (isWebProduction() && typeof window !== 'undefined') {
    const origin = normalizeOrigin(window.location.origin)
    return ids.filter(
      (id) => normalizeOrigin(TENANT_KEYS[id].webOrigin) === origin,
    )
  }

  return ids
}

/**
 * Returns true if the given string is a valid/available tenant id.
 * Pass devMode when checking from async context (e.g. callback) so dev-only tenants are allowed when dev mode is on.
 */
export function isAvailableTenantId(
  value: string,
  devMode?: boolean,
): value is TenantId {
  return getAvailableTenantIds(devMode ?? false).includes(value as TenantId)
}

/** Display labels for server (tenant) ids in the UI. "default" shows as "Utopia" (server name). */
const TENANT_LABELS: Record<TenantId, string> = {
  stillness: 'Stillness',
  liminality: 'Liminality',
  utopia: 'Utopia',
  umbra: 'Umbra',
  tauceti: 'Tauceti',
  tesseract: 'Tesseract',
  tetra: 'Tetra',
  tiaki: 'Tiaki',
}

/**
 * Returns the display label for a tenant id (e.g. "utopia" -> "Utopia").
 * Falls back to the id with first letter capitalized if unknown.
 */
export function getTenantLabel(tenantId: TenantId): string {
  return (
    TENANT_LABELS[tenantId as TenantId] ??
    tenantId.charAt(0).toUpperCase() + tenantId.slice(1)
  )
}
