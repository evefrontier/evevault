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

/** Known EVE coin types (one per tenant) for strict matching. */
const KNOWN_EVE_COIN_TYPES = new Set(
  (Object.keys(EVE_PACKAGE_ID_BY_TENANT) as TenantId[]).map(getEveCoinType),
);

/**
 * Returns true if the given coin type is a known EVE token (any tenant).
 */
export function isEveCoinType(coinType: string): boolean {
  return KNOWN_EVE_COIN_TYPES.has(coinType);
}
