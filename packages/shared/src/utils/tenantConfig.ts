import type { TenantConfig, TenantId } from "../types";
import { TENANT_KEYS } from ".";

export const DEFAULT_TENANT_ID = "stillness" as const;

const KNOWN_TENANT_IDS: TenantId[] = Object.keys(TENANT_KEYS) as TenantId[];

function getDefaultConfig(): TenantConfig {
  return TENANT_KEYS[DEFAULT_TENANT_ID];
}

/**
 * Returns FusionAuth client config for the given tenant.
 */
export function getTenantConfig(tenantId: TenantId): TenantConfig {
  const defaultConfig = getDefaultConfig();

  if (tenantId === DEFAULT_TENANT_ID) {
    return defaultConfig;
  }

  if (!TENANT_KEYS[tenantId].clientSecret) {
    throw Error(`Tenant "${tenantId}" has no client secret`);
  }

  return TENANT_KEYS[tenantId];
}

export function getDefaultTenantId(): TenantId {
  return DEFAULT_TENANT_ID;
}

/**
 * Returns tenant ids that have config: always the default tenant, plus others that have
 * client secret set. When isDev is false (production), tenants marked isDev: true are
 * excluded; when isDev is true, all tenants with client secret are included.
 */
export function getAvailableTenantIds(devMode = false): TenantId[] {
  const ids: TenantId[] = [DEFAULT_TENANT_ID];

  for (const id of KNOWN_TENANT_IDS) {
    if (id === DEFAULT_TENANT_ID) continue;
    const clientSecret = TENANT_KEYS[id].clientSecret;
    if (!clientSecret?.trim()) continue;
    if (!devMode && TENANT_KEYS[id].isDev) continue;
    ids.push(id);
  }

  return ids;
}

/**
 * Returns true if the given string is a valid/available tenant id.
 * Pass devMode when checking from async context (e.g. callback) so dev-only tenants are allowed when dev mode is on.
 */
export function isAvailableTenantId(
  value: string,
  devMode?: boolean,
): value is TenantId {
  return getAvailableTenantIds(devMode ?? false).includes(value as TenantId);
}

/** Display labels for server (tenant) ids in the UI. "default" shows as "Utopia" (server name). */
const TENANT_LABELS: Record<TenantId, string> = {
  stillness: "Stillness",
  utopia: "Utopia",
  testevenet: "Testevenet",
  nebula: "Nebula",
};

/**
 * Returns the display label for a tenant id (e.g. "utopia" -> "Utopia").
 * Falls back to the id with first letter capitalized if unknown.
 */
export function getTenantLabel(tenantId: TenantId): string {
  return (
    TENANT_LABELS[tenantId as TenantId] ??
    tenantId.charAt(0).toUpperCase() + tenantId.slice(1)
  );
}
