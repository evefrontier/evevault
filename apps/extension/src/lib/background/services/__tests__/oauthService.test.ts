import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAuthUrl } from '@/lib/background/services/oauthService'

const { getTenantConfigMock } = vi.hoisted(() => ({
  getTenantConfigMock: vi.fn(),
}))

vi.mock('@evevault/shared', () => ({
  getTenantConfig: getTenantConfigMock,
}))

describe('getAuthUrl', () => {
  beforeEach(() => {
    getTenantConfigMock.mockReturnValue({
      clientId: 'test-client-id',
      serverUrl: 'https://auth.example.com/',
    })

    globalThis.chrome = {
      identity: {
        getRedirectURL: vi.fn(
          () => 'https://extension.chromiumapp.org/callback',
        ),
      },
    } as unknown as typeof chrome
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('includes nonce when provided', () => {
    const authUrl = getAuthUrl({
      tenantId: 'stillness',
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
  })
})
