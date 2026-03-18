import { decodeJwt } from "jose";
import type { IdTokenClaims } from "oidc-client-ts";

const UTOPIA_TENANT = "utopia";
const UAT_TIER = "uat";

type JwtClaims = IdTokenClaims & { tenant?: string; tier?: string };

/**
 * Derives Eve Frontier API base URL and tenant from a JWT id_token.
 * Used by vend endpoint and sponsored transaction handler so URL formation stays consistent.
 */
export function getApiContext(token: string): {
  apiBaseUrl: string;
  tenant: string;
  decoded: JwtClaims;
} {
  const decoded = decodeJwt<JwtClaims>(token);
  const tenant = (decoded.tenant as string) || "";
  const tier =
    tenant === UTOPIA_TENANT
      ? `${UAT_TIER}.pub`
      : `${decoded.tier ?? "prod"}.tech`;
  const apiBaseUrl = `https://api.${tier}.evefrontier.com`;
  return { apiBaseUrl, tenant, decoded };
}
