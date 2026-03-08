import { getDevModeEnabled, TENANT_KEYS } from "../utils";

export const DEFAULT_TENANT_ID = "stillness" as const;

export type TenantId =
  | typeof DEFAULT_TENANT_ID
  | "utopia"
  | "stillness"
  | "testevenet"
  | "nebula";

export interface TenantConfig {
  clientId: string;
  clientSecret: string;
  serverUrl: string;
  isDev?: boolean;
}

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
export function getAvailableTenantIds(): TenantId[] {
  const isDev = getDevModeEnabled();

  const ids: TenantId[] = [DEFAULT_TENANT_ID];
  for (const id of KNOWN_TENANT_IDS) {
    if (id === DEFAULT_TENANT_ID) continue;
    const clientSecret = TENANT_KEYS[id].clientSecret;
    if (!clientSecret?.trim()) continue;
    if (!isDev && TENANT_KEYS[id].isDev) continue;
    ids.push(id);
  }
  return ids;
}

/**
 * Returns true if the given string is a valid/available tenant id.
 */
export function isAvailableTenantId(value: string): value is TenantId {
  return getAvailableTenantIds().includes(value as TenantId);
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
export function getTenantLabel(tenantId: string): string {
  return (
    TENANT_LABELS[tenantId as TenantId] ??
    tenantId.charAt(0).toUpperCase() + tenantId.slice(1)
  );
}
