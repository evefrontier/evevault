import type { TenantId } from '@evefrontier/wallet-core/tenant'
import { createRemoteJWKSet, type JWTPayload, jwtVerify } from 'jose'
import { getTenantConfig } from '#/utils/tenantConfig'

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

function getJwksForServer(
  serverUrl: string,
): ReturnType<typeof createRemoteJWKSet> {
  const normalized = serverUrl.replace(/\/$/, '')
  let jwks = jwksCache.get(normalized)
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${normalized}/.well-known/jwks.json`))
    jwksCache.set(normalized, jwks)
  }
  return jwks
}

/**
 * Verifies an id_token's signature against the given tenant's FusionAuth JWKS.
 * Throws on any failure (bad signature, wrong issuer/audience, expired token,
 * or an unreachable JWKS endpoint) — callers must treat this as a hard
 * failure and never fall back to trusting the unverified token.
 */
export async function verifyIdTokenForTenant(
  idToken: string,
  tenantId: TenantId,
): Promise<JWTPayload> {
  const { serverUrl, clientId } = getTenantConfig(tenantId)
  const jwks = getJwksForServer(serverUrl)
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: serverUrl,
    audience: clientId,
  })
  return payload
}
