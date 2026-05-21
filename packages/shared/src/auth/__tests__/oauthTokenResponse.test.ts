import { describe, expect, it } from 'vitest'
import { parseOAuthTokenResponse } from '#/auth/oauthTokenResponse'

describe('parseOAuthTokenResponse', () => {
  const base = {
    access_token: 'at',
    id_token:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.8VKCTiBegJPuPIZlp0wbV0Sbdn5BS6TE5DCx6oYNc5o',
    token_type: 'Bearer',
    scope: 'openid profile email offline_access',
    expires_in: 30,
    refresh_token: 'rt-1',
    refresh_token_id: 'rid-1',
    userId: 'user-1',
  }

  it('returns required fields and optional FusionAuth fields', () => {
    const out = parseOAuthTokenResponse(base)
    expect(out).toMatchObject({
      access_token: 'at',
      id_token:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.8VKCTiBegJPuPIZlp0wbV0Sbdn5BS6TE5DCx6oYNc5o',
      refresh_token: 'rt-1',
      token_type: 'Bearer',
      scope: 'openid profile email offline_access',
      expires_in: 30,
      refresh_token_id: 'rid-1',
      userId: 'user-1',
    })
  })

  it('trims string tokens', () => {
    const out = parseOAuthTokenResponse({
      ...base,
      access_token: '  a  ',
      id_token:
        '  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.8VKCTiBegJPuPIZlp0wbV0Sbdn5BS6TE5DCx6oYNc5o  ',
      refresh_token: '  r  ',
    })
    expect(out.access_token).toBe('a')
    expect(out.id_token).toBe(
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.8VKCTiBegJPuPIZlp0wbV0Sbdn5BS6TE5DCx6oYNc5o',
    )
    expect(out.refresh_token).toBe('r')
  })

  it('throws when refresh_token missing', () => {
    const { refresh_token: _r, ...rest } = base
    expect(() => parseOAuthTokenResponse(rest)).toThrow(
      'missing or empty refresh_token',
    )
  })

  it('throws when refresh_token empty', () => {
    expect(() =>
      parseOAuthTokenResponse({ ...base, refresh_token: '  ' }),
    ).toThrow('missing or empty refresh_token')
  })

  it('throws when access_token or id_token missing', () => {
    expect(() =>
      parseOAuthTokenResponse({
        id_token: 'i',
        refresh_token: 'r',
        expires_in: 1,
      }),
    ).toThrow('missing or empty access_token')
  })
})
