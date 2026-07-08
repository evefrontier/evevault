import { TenantId } from '@evefrontier/wallet-core/tenant'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeJwt } from '#/testing'

const { getTenantConfigMock, verifyIdTokenForTenantMock } = vi.hoisted(() => ({
  getTenantConfigMock: vi.fn(),
  verifyIdTokenForTenantMock: vi.fn(),
}))

const idToken = makeJwt({ sub: 'user-1', exp: 9_999_999_999 })

vi.mock('#/utils/tenantConfig', () => ({
  getTenantConfig: getTenantConfigMock,
}))
vi.mock('#/auth/verifyJwt', () => ({
  verifyIdTokenForTenant: verifyIdTokenForTenantMock,
}))

describe('exchangeCodeForToken', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses PKCE without sending a client secret for public clients', async () => {
    getTenantConfigMock.mockReturnValue({
      clientId: 'client-id',
      serverUrl: 'https://issuer.example',
    })
    verifyIdTokenForTenantMock.mockResolvedValue({ nonce: 'test-nonce' })
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'access-token',
          id_token: idToken,
          refresh_token: 'refresh-token',
          refresh_token_id: 'refresh-token-id',
          userId: 'user-1',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
        { status: 200 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const { exchangeCodeForToken } = await import('#/auth/exchangeCode')
    await exchangeCodeForToken(
      'auth-code',
      'chrome-extension://extension-id/callback.html',
      TenantId.STILLNESS,
      { codeVerifier: 'verifier', nonce: 'test-nonce' },
    )

    const body = fetchMock.mock.calls[0]?.[1]?.body as URLSearchParams
    expect(body.get('client_id')).toBe('client-id')
    expect(body.get('client_secret')).toBeNull()
    expect(body.get('code_verifier')).toBe('verifier')
  })

  it('throws when the returned id_token fails signature verification', async () => {
    getTenantConfigMock.mockReturnValue({
      clientId: 'client-id',
      serverUrl: 'https://issuer.example',
    })
    verifyIdTokenForTenantMock.mockRejectedValue(
      new Error('signature verification failed'),
    )
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: 'access-token',
            id_token: idToken,
            refresh_token: 'refresh-token',
            refresh_token_id: 'refresh-token-id',
            userId: 'user-1',
            token_type: 'Bearer',
            expires_in: 3600,
          }),
          { status: 200 },
        ),
      ),
    )

    const { exchangeCodeForToken } = await import('#/auth/exchangeCode')
    await expect(
      exchangeCodeForToken(
        'auth-code',
        'chrome-extension://extension-id/callback.html',
        TenantId.STILLNESS,
        { codeVerifier: 'verifier', nonce: 'test-nonce' },
      ),
    ).rejects.toThrow('signature verification failed')
  })

  it('throws when the verified nonce does not match the nonce sent', async () => {
    getTenantConfigMock.mockReturnValue({
      clientId: 'client-id',
      serverUrl: 'https://issuer.example',
    })
    verifyIdTokenForTenantMock.mockResolvedValue({ nonce: 'wrong-nonce' })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: 'access-token',
            id_token: idToken,
            refresh_token: 'refresh-token',
            refresh_token_id: 'refresh-token-id',
            userId: 'user-1',
            token_type: 'Bearer',
            expires_in: 3600,
          }),
          { status: 200 },
        ),
      ),
    )

    const { exchangeCodeForToken } = await import('#/auth/exchangeCode')
    await expect(
      exchangeCodeForToken(
        'auth-code',
        'chrome-extension://extension-id/callback.html',
        TenantId.STILLNESS,
        { codeVerifier: 'verifier', nonce: 'test-nonce' },
      ),
    ).rejects.toThrow(/nonce/i)
  })
})
