import { decodeJwt } from 'jose'
import type { IdTokenClaims } from 'oidc-client-ts'

const STILLNESS_TENANT = 'stillness'
const UTOPIA_TENANT = 'utopia'
const UAT_TIER = 'uat'

const VALID_TIERS = new Set(['dev', 'test', 'uat', 'live'])

type JwtClaims = IdTokenClaims & { tenant?: string; tier?: string }

/**
 * Derives Eve Frontier API base URL and tenant from a JWT id_token.
 * Used by vend endpoint and sponsored transaction handler so URL formation stays consistent.
 */
export function getApiContext(token: string): {
  apiBaseUrl: string
  tenant: string
  decoded: JwtClaims
} {
  const decoded = decodeJwt<JwtClaims>(token)
  const tenant = (decoded.tenant as string) || ''
  const tier = resolveTier(tenant, decoded)

  if (!VALID_TIERS.has(tier)) {
    throw new Error('Invalid tier claim in token')
  }

  const apiBaseUrl = `https://api.${tier}.pub.evefrontier.com`
  return { apiBaseUrl, tenant, decoded }
}

function resolveTier(tenant: string, decoded: JwtClaims): string {
  switch (tenant) {
    case STILLNESS_TENANT:
      return `${decoded.tier ?? 'live'}`
    case UTOPIA_TENANT:
      return `${UAT_TIER}`
    default:
      return `${decoded.tier ?? 'test'}`
  }
}
