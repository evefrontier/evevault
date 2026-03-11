import type { TenantId } from "../types/tenant";

/** EVE token package ID per tenant (Sui Move package object ID). Coin type is derived as `{packageId}::EVE::EVE`. */
export const EVE_PACKAGE_ID_BY_TENANT: Record<TenantId, string> = {
  nebula: "0x6407060579895a8b30f7d30d2447046eb80ecc23f0c9acde09222b2a505583c9",
  testevenet:
    "0x6407060579895a8b30f7d30d2447046eb80ecc23f0c9acde09222b2a505583c9",
  utopia: "0xf0446b93345c1118f21239d7ac58fb82d005219b2016e100f074e4d17162a465",
  stillness:
    "0x2a66a89b5a735738ffa4423ac024d23571326163f324f9051557617319e59d60",
};

const EVE_COIN_TYPE_SUFFIX = "::EVE::EVE";

/**
 * Returns the EVE token coin type for the given tenant.
 * Format: `{packageId}::EVE::EVE` (Sui Move type used by RPC/GraphQL).
 */
export function getEveCoinType(tenantId: TenantId): string {
  return `${EVE_PACKAGE_ID_BY_TENANT[tenantId]}${EVE_COIN_TYPE_SUFFIX}`;
}

/** Legacy EVE coin type from before per-tenant packages were introduced. */
const LEGACY_EVE_COIN_TYPE =
  "0x59d7bb2e0feffb90cb2446fb97c2ce7d4bd24d2fb98939d6cb6c3940110a0de0::EVE::EVE";

/** All known EVE coin types: current tenants + legacy. */
const KNOWN_EVE_COIN_TYPES = new Set([
  ...(Object.keys(EVE_PACKAGE_ID_BY_TENANT) as TenantId[]).map(getEveCoinType),
  LEGACY_EVE_COIN_TYPE,
]);

/**
 * Returns true if the given coin type is a known EVE token (any tenant, including legacy).
 */
export function isEveCoinType(coinType: string): boolean {
  return KNOWN_EVE_COIN_TYPES.has(coinType);
}
