import type { TenantConfig, TenantId } from "../types";
import { TENANT_KEYS } from "./constants";
import { isWeb } from "./environment";

export const DEFAULT_TENANT_ID = "stillness" as const;

const KNOWN_TENANT_IDS: TenantId[] = Object.keys(TENANT_KEYS) as TenantId[];

function normalizeOrigin(url: string): string {
  return url.replace(/\/$/, "");
}

function isWebProduction(): boolean {
  if (!isWeb()) return false;
  const nodeEnv =
    typeof globalThis !== "undefined" &&
    (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env
      ?.NODE_ENV;
  const importMetaMode =
    typeof import.meta !== "undefined" &&
    (import.meta as { env?: { MODE?: string } }).env?.MODE;
  const mode = nodeEnv ?? importMetaMode;
  return mode === "production";
}

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
 *
 * When deployed to web production, this will also check to ensure that the URL matches the server URL for the tenant.
 * If the URL does not match the server URL for the tenant, the tenant is not included.
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

  if (isWebProduction() && typeof window !== "undefined") {
    const origin = normalizeOrigin(window.location.origin);
    return ids.filter(
      (id) => normalizeOrigin(TENANT_KEYS[id].webOrigin) === origin,
    );
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
