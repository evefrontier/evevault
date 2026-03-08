import { createLogger } from "../utils/logger";

const log = createLogger();

export const DEFAULT_TENANT_ID = "default" as const;

export type TenantId =
  | typeof DEFAULT_TENANT_ID
  | "utopia"
  | "testevenet"
  | "nebula";

export interface TenantConfig {
  clientId: string;
  clientSecret: string;
  serverUrl: string;
}

const KNOWN_TENANT_IDS: TenantId[] = [
  DEFAULT_TENANT_ID,
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
  const clientId = getEnv("VITE_FUSIONAUTH_CLIENT_ID") ?? "";
  const clientSecret = getEnv("VITE_FUSION_CLIENT_SECRET") ?? "";
  const serverUrl = getEnv("VITE_FUSION_SERVER_URL") ?? "";
  return { clientId, clientSecret, serverUrl };
}

function getTenantEnvKey(tenantId: string, suffix: string): string {
  const upper = tenantId.toUpperCase().replace(/-/g, "_");
  return `VITE_TENANT_${upper}_${suffix}`;
}

/**
 * Returns FusionAuth client config for the given tenant.
 * "default" always uses main env (VITE_FUSIONAUTH_CLIENT_ID, etc.).
 * Other ids use VITE_TENANT_<ID>_CLIENT_ID / _CLIENT_SECRET / _SERVER_URL when set.
 */
export function getTenantConfig(tenantId: string): TenantConfig {
  const defaultConfig = getDefaultConfig();

  if (tenantId === DEFAULT_TENANT_ID) {
    return defaultConfig;
  }

  const clientId = getEnv(getTenantEnvKey(tenantId, "CLIENT_ID"));
  const clientSecret = getEnv(getTenantEnvKey(tenantId, "CLIENT_SECRET"));
  const serverUrl =
    getEnv(getTenantEnvKey(tenantId, "SERVER_URL")) ?? defaultConfig.serverUrl;

  if (clientId && clientSecret) {
    return { clientId, clientSecret, serverUrl };
  }

  log.warn(
    `Tenant "${tenantId}" has no VITE_TENANT_* env; falling back to default`,
  );
  return defaultConfig;
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
  default: "Utopia",
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
