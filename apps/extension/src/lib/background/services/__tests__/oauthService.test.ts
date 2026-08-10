import { TenantId } from '@evefrontier/wallet-core/tenant'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAuthRequest } from '@/lib/background/services/oauthService'

const BASE64URL = /^[A-Za-z0-9_-]+$/

const { getTenantConfigMock } = vi.hoisted(() => ({
  getTenantConfigMock: vi.fn(),
}))

vi.mock('@evevault/shared', () => ({
  getTenantConfig: getTenantConfigMock,
}))

describe('getAuthRequest', () => {
  beforeEach(() => {
    getTenantConfigMock.mockReturnValue({
      clientId: 'test-client-id',
      serverUrl: 'https://auth.example.com/',
    })

    vi.stubGlobal('browser', {
      identity: {
        getRedirectURL: vi.fn(
          () => 'https://extension.chromiumapp.org/callback',
        ),
      },
    } as unknown as typeof browser)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('builds a well-formed auth URL with nonce, PKCE, and state', async () => {
    const { authUrl, codeVerifier, state } = await getAuthRequest({
      tenantId: TenantId.STILLNESS,
      nonce: 'test-nonce',
    })

    expect(authUrl.origin).toBe('https://auth.example.com')
    expect(authUrl.pathname).toBe('/oauth2/authorize')
    expect(authUrl.searchParams.get('client_id')).toBe('test-client-id')
    expect(authUrl.searchParams.get('redirect_uri')).toBe(
      'https://extension.chromiumapp.org/callback',
    )
    expect(authUrl.searchParams.get('scope')).toBe(
      'openid profile email offline_access',
    )
    expect(authUrl.searchParams.get('nonce')).toBe('test-nonce')
    expect(codeVerifier).toMatch(BASE64URL)
    expect(authUrl.searchParams.get('code_challenge')).toMatch(BASE64URL)
    expect(authUrl.searchParams.get('code_challenge_method')).toBe('S256')
    expect(state).toMatch(BASE64URL)
    expect(authUrl.searchParams.get('state')).toBe(state)
  })
})
