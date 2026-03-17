import {
  EVE_PACKAGE_ID_BY_TENANT,
  getEveCoinType,
} from "@evefrontier/dapp-kit/utils";
import type { TenantId } from "../types/tenant";

export { getEveCoinType };

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
