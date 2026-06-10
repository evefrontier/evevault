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

describe('resolveExpiresAt — additional branches', () => {
  const NOW_ISO = '2025-06-01T12:00:00.000Z'
  const NOW_SEC = Math.floor(new Date(NOW_ISO).getTime() / 1000)

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW_ISO))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const base = {
    scope: 's',
    token_type: 'Bearer',
  } as const

  it('prefers the exp claim from the access_token', () => {
    const accessWithExp = new UnsecuredJWT({ sub: 'u' })
      .setExpirationTime(1_111_111)
      .encode()
    const idWithExp = new UnsecuredJWT({ sub: 'u' })
      .setExpirationTime(2_222_222)
      .encode()

    expect(
      resolveExpiresAt({
        ...base,
        access_token: accessWithExp,
        id_token: idWithExp,
        expires_in: 3600,
      } as JwtResponse),
    ).toBe(1_111_111)
  })

  it('falls back to the id_token exp when the access_token has none', () => {
    const accessOpaque = 'opaque-access'
    const idWithExp = new UnsecuredJWT({ sub: 'u' })
      .setExpirationTime(3_333_333)
      .encode()

    expect(
      resolveExpiresAt({
        ...base,
        access_token: accessOpaque,
        id_token: idWithExp,
        expires_in: 3600,
      } as JwtResponse),
    ).toBe(3_333_333)
  })

  it('anchors expires_in to Date.now() when no token carries iat', () => {
    expect(
      resolveExpiresAt({
        ...base,
        access_token: 'opaque-a',
        id_token: 'opaque-i',
        expires_in: 200,
      } as JwtResponse),
    ).toBe(NOW_SEC + 200)
  })

  it('handles a missing access_token (only id_token present)', () => {
    const idWithIat = new UnsecuredJWT({ sub: 'u' })
      .setIssuedAt(1748779000)
      .encode()

    expect(
      resolveExpiresAt({
        ...base,
        id_token: idWithIat,
      } as JwtResponse),
    ).toBe(1748779000)
  })

  it('last resort: treats opaque tokens with no expiry info as expiring now', () => {
    expect(
      resolveExpiresAt({
        ...base,
        access_token: 'opaque-a',
        id_token: 'opaque-i',
      } as JwtResponse),
    ).toBe(NOW_SEC)
  })
})

describe('getUserForNetwork — sui_address from claims', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  const storedJwtWith = (idToken: string) => ({
    access_token: 'at',
    id_token: idToken,
    expires_in: 3600,
    scope: 'openid',
    token_type: 'Bearer',
  })

  it('returns a User directly from the sui_address claim without calling zkLogin', async () => {
    const idToken = new UnsecuredJWT({
      sub: 'u1',
      sui_address: '0xfromclaim',
      salt: '77',
    }).encode()
    vi.mocked(getJwt).mockResolvedValue(storedJwtWith(idToken))

    const user = await getUserForNetwork('sui:testnet')

    expect(user?.profile?.sui_address).toBe('0xfromclaim')
    expect(user?.profile?.salt).toBe('77')
    expect(getZkLoginAddress).not.toHaveBeenCalled()
  })

  it('omits salt when the claim has no salt', async () => {
    const idToken = new UnsecuredJWT({
      sub: 'u1',
      sui_address: '0xfromclaim',
    }).encode()
    vi.mocked(getJwt).mockResolvedValue(storedJwtWith(idToken))

    const user = await getUserForNetwork('sui:testnet')

    expect(user?.profile?.sui_address).toBe('0xfromclaim')
    expect(user?.profile?.salt).toBeUndefined()
    expect(getZkLoginAddress).not.toHaveBeenCalled()
  })

  it('falls through to zkLogin when sui_address claim is whitespace only', async () => {
    const idToken = new UnsecuredJWT({
      sub: 'u1',
      sui_address: '   ',
    }).encode()
    vi.mocked(getJwt).mockResolvedValue(storedJwtWith(idToken))
    vi.mocked(getZkLoginAddress).mockResolvedValue({
      data: { address: '0xzk', salt: '5', publicKey: 'pk' },
      error: undefined,
    })

    const user = await getUserForNetwork('sui:testnet')

    expect(getZkLoginAddress).toHaveBeenCalled()
    expect(user?.profile?.sui_address).toBe('0xzk')
  })
})
