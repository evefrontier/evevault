import { TenantId } from '@evefrontier/dapp-kit'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeJwt } from '#/testing'

const { getTenantConfigMock } = vi.hoisted(() => ({
  getTenantConfigMock: vi.fn(),
}))

const idToken = makeJwt({ sub: 'user-1', exp: 9_999_999_999 })

vi.mock('#/utils/tenantConfig', () => ({
  getTenantConfig: getTenantConfigMock,
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
      { codeVerifier: 'verifier' },
    )

    const body = fetchMock.mock.calls[0]?.[1]?.body as URLSearchParams
    expect(body.get('client_id')).toBe('client-id')
    expect(body.get('client_secret')).toBeNull()
    expect(body.get('code_verifier')).toBe('verifier')
  })
})
