import { UnsecuredJWT } from 'jose'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { JwtResponse } from '#/types/authTypes'

vi.mock('#/auth/getZkLoginAddress', () => ({
  getZkLoginAddress: vi.fn(),
}))

vi.mock('#/auth/storageService', () => ({
  getJwt: vi.fn(),
}))

vi.mock('#/auth/stores/authStore', () => ({
  getEnokiApiKey: vi.fn(() => 'test-enoki-key'),
}))

import { getZkLoginAddress } from '#/auth/getZkLoginAddress'
import { getJwt } from '#/auth/storageService'
import {
  getUserForNetwork,
  isErrorWithMessage,
  resolveExpiresAt,
} from '#/auth/utils/authStoreUtils'

describe('isErrorWithMessage', () => {
  it('returns true for object with string message', () => {
    expect(isErrorWithMessage({ message: 'x' })).toBe(true)
  })

  it('returns false for null', () => {
    expect(isErrorWithMessage(null)).toBe(false)
  })

  it('returns false when message is not a string', () => {
    expect(isErrorWithMessage({ message: 1 })).toBe(false)
  })

  it('returns false when message property is missing', () => {
    expect(isErrorWithMessage({})).toBe(false)
  })
})

describe('resolveExpiresAt', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-01T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // JWT with iat=1748779000 but no exp
  const tokenWithIat = new UnsecuredJWT({ sub: 'u1' })
    .setIssuedAt(1748779000)
    .encode()

  // JWTs carrying an explicit `exp` claim (the common production case)
  const tokenWithExp = (exp: number, iat = 1748779000) =>
    new UnsecuredJWT({ sub: 'u1', exp, iat }).encode()

  it('uses the exp claim from access_token when expires_at absent', () => {
    expect(
      resolveExpiresAt({
        access_token: tokenWithExp(1_800_000_500),
        id_token: tokenWithIat,
        expires_in: 120,
        scope: 's',
        token_type: 'Bearer',
      }),
    ).toBe(1_800_000_500)
  })

  it('prefers the access_token exp over the id_token exp', () => {
    expect(
      resolveExpiresAt({
        access_token: tokenWithExp(1_800_000_111),
        id_token: tokenWithExp(1_800_000_222),
        scope: 's',
        token_type: 'Bearer',
      }),
    ).toBe(1_800_000_111)
  })

  it('falls back to the id_token exp when access_token has none', () => {
    expect(
      resolveExpiresAt({
        access_token: tokenWithIat,
        id_token: tokenWithExp(1_800_000_333),
        scope: 's',
        token_type: 'Bearer',
      }),
    ).toBe(1_800_000_333)
  })

  it('anchors expires_in to the id_token iat when both tokens carry iat', () => {
    const idToken = new UnsecuredJWT({ sub: 'u1' })
      .setIssuedAt(1_700_000_000)
      .encode()
    const accessToken = new UnsecuredJWT({ sub: 'u1' })
      .setIssuedAt(1_600_000_000)
      .encode()
    expect(
      resolveExpiresAt({
        access_token: accessToken,
        id_token: idToken,
        expires_in: 300,
        scope: 's',
        token_type: 'Bearer',
      }),
    ).toBe(1_700_000_000 + 300)
  })

  it('uses Date.now() + expires_in when neither token carries iat', () => {
    const noClaims = new UnsecuredJWT({ sub: 'u1' }).encode()
    expect(
      resolveExpiresAt({
        access_token: noClaims,
        id_token: noClaims,
        expires_in: 300,
        scope: 's',
        token_type: 'Bearer',
      }),
    ).toBe(
      Math.floor(new Date('2025-06-01T12:00:00.000Z').getTime() / 1000) + 300,
    )
  })

  it('tolerates an opaque (non-JWT) token and falls back to now', () => {
    expect(
      resolveExpiresAt({
        access_token: 'not-a-jwt',
        id_token: 'also-not-a-jwt',
        scope: 's',
        token_type: 'Bearer',
      } as JwtResponse),
    ).toBe(Math.floor(new Date('2025-06-01T12:00:00.000Z').getTime() / 1000))
  })

  it('uses expires_at when present', () => {
    expect(
      resolveExpiresAt({
        access_token: 'a',
        id_token: 'i',
        expires_in: 3600,
        scope: 's',
        token_type: 'Bearer',
        expires_at: 1_900_000_000,
      }),
    ).toBe(1_900_000_000)
  })

  it('uses iat + expires_in when expires_at absent', () => {
    expect(
      resolveExpiresAt({
        access_token: 'a',
        id_token: tokenWithIat,
        expires_in: 120,
        scope: 's',
        token_type: 'Bearer',
      }),
    ).toBe(1748779000 + 120)
  })

  it('falls back to iat when expires_at and expires_in are not usable numbers', () => {
    expect(
      resolveExpiresAt({
        access_token: tokenWithIat,
        id_token: tokenWithIat,
        scope: 's',
        token_type: 'Bearer',
      } as JwtResponse),
    ).toBe(1748779000)
  })
})

describe('getUserForNetwork', () => {
  // JWT with iat=1748779000 but no exp
  const tokenWithClaims = new UnsecuredJWT({ sub: 'u1', aud: 'aud1' })
    .setIssuedAt(1748779000)
    .encode()

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when no JWT for chain', async () => {
    vi.mocked(getJwt).mockResolvedValue(null)
    await expect(getUserForNetwork('sui:testnet')).resolves.toBeNull()
    expect(getZkLoginAddress).not.toHaveBeenCalled()
  })

  it('returns null when JWT has no id_token', async () => {
    vi.mocked(getJwt).mockResolvedValue({
      access_token: 'a',
      id_token: '',
      expires_in: 3600,
      scope: 's',
      token_type: 'Bearer',
    })
    await expect(getUserForNetwork('sui:testnet')).resolves.toBeNull()
    expect(getZkLoginAddress).not.toHaveBeenCalled()
  })

  it('returns null when zkLogin returns error', async () => {
    vi.mocked(getJwt).mockResolvedValue({
      access_token: 'a',
      id_token: tokenWithClaims,
      expires_in: 3600,
      scope: 's',
      token_type: 'Bearer',
    })
    vi.mocked(getZkLoginAddress).mockResolvedValue({
      data: undefined,
      error: { message: 'enoki failed' },
    })
    await expect(getUserForNetwork('sui:testnet')).resolves.toBeNull()
  })

  it('returns null when zkLogin has no data', async () => {
    vi.mocked(getJwt).mockResolvedValue({
      access_token: 'a',
      id_token: tokenWithClaims,
      expires_in: 3600,
      scope: 's',
      token_type: 'Bearer',
    })
    vi.mocked(getZkLoginAddress).mockResolvedValue({
      data: undefined,
      error: undefined,
    })
    await expect(getUserForNetwork('sui:testnet')).resolves.toBeNull()
  })

  it('returns User when zkLogin succeeds', async () => {
    vi.mocked(getJwt).mockResolvedValue({
      access_token: 'at',
      id_token: tokenWithClaims,
      expires_in: 3600,
      scope: 'openid',
      token_type: 'Bearer',
      expires_at: 2_000_000_000,
    })
    vi.mocked(getZkLoginAddress).mockResolvedValue({
      data: {
        address: '0xsui',
        salt: '99',
        publicKey: 'pk',
      },
      error: undefined,
    })

    const user = await getUserForNetwork('sui:testnet')
    expect(user).not.toBeNull()
    expect(user?.id_token).toBe(tokenWithClaims)
    expect(user?.profile?.sui_address).toBe('0xsui')
    expect(user?.profile?.salt).toBe('99')
    expect(user?.expires_at).toBe(2_000_000_000)
  })
})
