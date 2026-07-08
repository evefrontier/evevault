import type { TenantId } from '@evefrontier/wallet-core/tenant'
import { createRemoteJWKSet, type JWTPayload, jwtVerify } from 'jose'
import { getTenantConfig } from '#/utils/tenantConfig'

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>()
// The `iss` claim FusionAuth stamps into tokens is a separately-configured
// value, not guaranteed to equal the authority URL used for OAuth endpoints
// (e.g. it may omit the scheme). Discover it from the OIDC metadata document
// instead of assuming it matches `serverUrl`.
const issuerCache = new Map<string, Promise<string>>()

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

async function getIssuerForServer(serverUrl: string): Promise<string> {
  const normalized = serverUrl.replace(/\/$/, '')
  let issuer = issuerCache.get(normalized)
  if (!issuer) {
    issuer = (async () => {
      const response = await fetch(
        `${normalized}/.well-known/openid-configuration`,
      )
      if (!response.ok) {
        throw new Error(
          `Failed to fetch OIDC discovery document for ${normalized}: ${response.status}`,
        )
      }
      const config = (await response.json()) as { issuer?: unknown }
      if (typeof config.issuer !== 'string' || !config.issuer) {
        throw new Error(
          `OIDC discovery document for ${normalized} has no valid "issuer"`,
        )
      }
      return config.issuer
    })().catch((error) => {
      issuerCache.delete(normalized)
      throw error
    })
    issuerCache.set(normalized, issuer)
  }
  return issuer
}

/**
 * Verifies an id_token's signature against the given tenant's FusionAuth JWKS.
 * Throws on any failure (bad signature, wrong issuer/audience, expired token,
 * or an unreachable/invalid JWKS/metadata endpoint) — callers must treat this
 * as a hard failure and never fall back to trusting the unverified token.
 */
export async function verifyIdTokenForTenant(
  idToken: string,
  tenantId: TenantId,
): Promise<JWTPayload> {
  const { serverUrl, clientId } = getTenantConfig(tenantId)
  const jwks = getJwksForServer(serverUrl)
  const issuer = await getIssuerForServer(serverUrl)
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer,
    audience: clientId,
  })
  return payload
}
