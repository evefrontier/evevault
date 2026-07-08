// @vitest-environment node

import {
  type CryptoKey,
  exportJWK,
  generateKeyPair,
  type JWK,
  SignJWT,
} from 'jose'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('#/utils/tenantConfig', () => ({
  getTenantConfig: vi.fn(),
}))

import { verifyIdTokenForTenant } from '#/auth/verifyJwt'
import { getTenantConfig } from '#/utils/tenantConfig'

const KID = 'test-kid'
const AUDIENCE = 'test-client-id'

let privateKey: CryptoKey
let publicJwk: JWK
// Each test uses a distinct serverUrl so the module-level JWKS/issuer caches
// in verifyJwt.ts never reuse a previous test's (now-stale) cached value.
// SERVER_URL is what getTenantConfig returns (used for OAuth endpoints);
let SERVER_URL: string
// BARE_ISSUER mirrors the `iss` claim being omitted in FusionAuth.
let BARE_ISSUER: string
let testCounter = 0

const signToken = async (
  overrides: {
    issuer?: string
    audience?: string
    expiresIn?: string
    kid?: string
    key?: CryptoKey
    claims?: Record<string, unknown>
  } = {},
) => {
  return new SignJWT({ sub: 'user-1', ...overrides.claims })
    .setProtectedHeader({ alg: 'RS256', kid: overrides.kid ?? KID })
    .setIssuedAt()
    .setIssuer(overrides.issuer ?? BARE_ISSUER)
    .setAudience(overrides.audience ?? AUDIENCE)
    .setExpirationTime(overrides.expiresIn ?? '1h')
    .sign(overrides.key ?? privateKey)
}

const jsonResponse = (body: unknown) => ({
  ok: true,
  status: 200,
  headers: new Headers({ 'content-type': 'application/json' }),
  json: () => Promise.resolve(body),
})

/**
 * Real FusionAuth tenants can have an `issuer` in their OIDC metadata that
 * differs from the `serverUrl` used for OAuth endpoints (e.g. no scheme) —
 * `discoveredIssuer` defaults to bare-hostname `ISSUER` to match that.
 */
const stubDiscoveryFetch = (
  jwks: { keys: JWK[] },
  discoveredIssuer: string,
) => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/.well-known/jwks.json')) {
        return Promise.resolve(jsonResponse(jwks))
      }
      if (url.endsWith('/.well-known/openid-configuration')) {
        return Promise.resolve(jsonResponse({ issuer: discoveredIssuer }))
      }
      return Promise.reject(new Error(`Unexpected fetch to ${url}`))
    }),
  )
}

describe('verifyIdTokenForTenant', () => {
  beforeEach(async () => {
    testCounter += 1
    SERVER_URL = `https://issuer-${testCounter}.example.com`
    BARE_ISSUER = `issuer-${testCounter}.example.com`
    vi.mocked(getTenantConfig).mockReturnValue({
      clientId: AUDIENCE,
      serverUrl: SERVER_URL,
    } as ReturnType<typeof getTenantConfig>)

    const { privateKey: priv, publicKey } = await generateKeyPair('RS256')
    privateKey = priv
    publicJwk = {
      ...(await exportJWK(publicKey)),
      kid: KID,
      alg: 'RS256',
      use: 'sig',
    }
    stubDiscoveryFetch({ keys: [publicJwk] }, BARE_ISSUER)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('accepts a validly signed token from the expected issuer/audience', async () => {
    const token = await signToken()
    const payload = await verifyIdTokenForTenant(token, 'stillness' as never)
    expect(payload.sub).toBe('user-1')
  })

  it('accepts a token whose iss omits the scheme present in serverUrl (real FusionAuth behavior)', async () => {
    // Regression test: FusionAuth's discovered `issuer` (and the token's own
    // `iss`) can be a bare hostname even though serverUrl (used for OAuth
    // endpoints) has an `https://` scheme. The expected issuer must come
    // from discovery, not from serverUrl directly, or this always fails.
    expect(SERVER_URL).toBe(`https://${BARE_ISSUER}`)
    const token = await signToken({ issuer: BARE_ISSUER })
    const payload = await verifyIdTokenForTenant(token, 'stillness' as never)
    expect(payload.sub).toBe('user-1')
  })

  it('rejects a token signed with a key not in the JWKS', async () => {
    const { privateKey: otherKey } = await generateKeyPair('RS256')
    const token = await signToken({ key: otherKey })
    await expect(
      verifyIdTokenForTenant(token, 'stillness' as never),
    ).rejects.toThrow()
  })

  it('rejects a token with the wrong issuer', async () => {
    const token = await signToken({ issuer: 'https://attacker.example.com' })
    await expect(
      verifyIdTokenForTenant(token, 'stillness' as never),
    ).rejects.toThrow()
  })

  it('rejects a token with the wrong audience', async () => {
    const token = await signToken({ audience: 'someone-elses-client' })
    await expect(
      verifyIdTokenForTenant(token, 'stillness' as never),
    ).rejects.toThrow()
  })

  it('rejects an expired token', async () => {
    const token = await signToken({ expiresIn: '-1h' })
    await expect(
      verifyIdTokenForTenant(token, 'stillness' as never),
    ).rejects.toThrow()
  })

  it('rejects when the JWKS endpoint is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.endsWith('/.well-known/openid-configuration')) {
          return Promise.resolve(jsonResponse({ issuer: BARE_ISSUER }))
        }
        return Promise.reject(new Error('network down'))
      }),
    )
    const token = await signToken()
    await expect(
      verifyIdTokenForTenant(token, 'stillness' as never),
    ).rejects.toThrow()
  })

  it('rejects when the discovery (openid-configuration) endpoint is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.endsWith('/.well-known/jwks.json')) {
          return Promise.resolve(jsonResponse({ keys: [publicJwk] }))
        }
        return Promise.reject(new Error('network down'))
      }),
    )
    const token = await signToken()
    await expect(
      verifyIdTokenForTenant(token, 'stillness' as never),
    ).rejects.toThrow()
  })

  it('rejects when the discovery endpoint returns a non-2xx response, rather than silently skipping issuer validation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.endsWith('/.well-known/jwks.json')) {
          return Promise.resolve(jsonResponse({ keys: [publicJwk] }))
        }
        if (url.endsWith('/.well-known/openid-configuration')) {
          return Promise.resolve({
            ok: false,
            status: 500,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: () => Promise.resolve({ error: 'internal server error' }),
          })
        }
        return Promise.reject(new Error(`Unexpected fetch to ${url}`))
      }),
    )
    const token = await signToken()
    await expect(
      verifyIdTokenForTenant(token, 'stillness' as never),
    ).rejects.toThrow(/discovery document/i)
  })

  it('rejects when the discovery document has no valid issuer field, rather than silently skipping issuer validation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.endsWith('/.well-known/jwks.json')) {
          return Promise.resolve(jsonResponse({ keys: [publicJwk] }))
        }
        if (url.endsWith('/.well-known/openid-configuration')) {
          // Malformed/unexpected shape: no `issuer` field at all.
          return Promise.resolve(jsonResponse({ authorization_endpoint: 'x' }))
        }
        return Promise.reject(new Error(`Unexpected fetch to ${url}`))
      }),
    )
    const token = await signToken()
    await expect(
      verifyIdTokenForTenant(token, 'stillness' as never),
    ).rejects.toThrow(/no valid "issuer"/i)
  })
})
