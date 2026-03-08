import { TENANT_KEYS } from "../utils";

export const DEFAULT_TENANT_ID = "utopia" as const;

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
}

const KNOWN_TENANT_IDS: TenantId[] = [
  "stillness",
  "utopia",
  "testevenet",
  "nebula",
];

function getEnv(key: string): string | undefined {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return (import.meta.env as Record<string, string | undefined>)[key];
  }
  return undefined;
}

function getDefaultConfig(): TenantConfig {
  return TENANT_KEYS[DEFAULT_TENANT_ID];
}

function getTenantEnvKey(tenantId: string, suffix: string): string {
  const upper = tenantId.toUpperCase().replace(/-/g, "_");
  return `VITE_TENANT_${upper}_${suffix}`;
}

/**
 * Returns FusionAuth client config for the given tenant.
 */
export function getTenantConfig(tenantId: string): TenantConfig {
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
 * Returns tenant ids that have config: always ["default"], plus any named tenant
 * for which VITE_TENANT_<id>_CLIENT_ID is set.
 */
export function getAvailableTenantIds(): TenantId[] {
  const ids: TenantId[] = [DEFAULT_TENANT_ID];
  for (const id of KNOWN_TENANT_IDS) {
    if (id === DEFAULT_TENANT_ID) continue;
    const clientId = getEnv(getTenantEnvKey(id, "CLIENT_ID"));
    if (clientId?.trim()) {
      ids.push(id);
    }
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
