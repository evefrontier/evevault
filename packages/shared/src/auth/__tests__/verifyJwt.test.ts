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
// Each test uses a distinct serverUrl so the module-level JWKS cache in
// verifyJwt.ts never reuses a previous test's (now-stale) cached key.
let ISSUER: string
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
    .setIssuer(overrides.issuer ?? ISSUER)
    .setAudience(overrides.audience ?? AUDIENCE)
    .setExpirationTime(overrides.expiresIn ?? '1h')
    .sign(overrides.key ?? privateKey)
}

const stubJwksFetch = (jwks: { keys: JWK[] }) => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve(jwks),
    }),
  )
}

describe('verifyIdTokenForTenant', () => {
  beforeEach(async () => {
    testCounter += 1
    ISSUER = `https://issuer-${testCounter}.example.com`
    vi.mocked(getTenantConfig).mockReturnValue({
      clientId: AUDIENCE,
      serverUrl: ISSUER,
    } as ReturnType<typeof getTenantConfig>)

    const { privateKey: priv, publicKey } = await generateKeyPair('RS256')
    privateKey = priv
    publicJwk = {
      ...(await exportJWK(publicKey)),
      kid: KID,
      alg: 'RS256',
      use: 'sig',
    }
    stubJwksFetch({ keys: [publicJwk] })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('accepts a validly signed token from the expected issuer/audience', async () => {
    const token = await signToken()
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
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const token = await signToken()
    await expect(
      verifyIdTokenForTenant(token, 'stillness' as never),
    ).rejects.toThrow()
  })
})
