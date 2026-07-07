import { UnsecuredJWT } from 'jose'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { JwtResponse } from '#/types/authTypes'

vi.mock('#/auth/getZkLoginAddress', () => ({
  getZkLoginAddress: vi.fn(),
}))

vi.mock('#/auth/storageService', () => ({
  getJwt: vi.fn(),
}))

import type { User } from 'oidc-client-ts'
import { getZkLoginAddress } from '#/auth/getZkLoginAddress'
import { getJwt } from '#/auth/storageService'
import {
  getHeaderIdentity,
  getUserForNetwork,
  isErrorWithMessage,
  resolveExpiresAt,
} from '#/auth/utils/authStoreUtils'

describe('getHeaderIdentity', () => {
  const userWith = (profile: unknown): User => ({ profile }) as unknown as User

  it('returns the email and sui_address when both are strings', () => {
    expect(
      getHeaderIdentity(
        userWith({ email: 'a@example.com', sui_address: '0xabc' }),
      ),
    ).toEqual({ email: 'a@example.com', address: '0xabc' })
  })

  it('collapses a missing email to an empty string', () => {
    expect(getHeaderIdentity(userWith({ sui_address: '0xabc' }))).toEqual({
      email: '',
      address: '0xabc',
    })
  })

  it('collapses a missing sui_address to an empty string', () => {
    expect(getHeaderIdentity(userWith({ email: 'a@example.com' }))).toEqual({
      email: 'a@example.com',
      address: '',
    })
  })

  it('collapses non-string claims to empty strings', () => {
    expect(
      getHeaderIdentity(userWith({ email: 123, sui_address: { foo: 1 } })),
    ).toEqual({ email: '', address: '' })
  })

  it('returns empty strings when profile is undefined', () => {
    expect(getHeaderIdentity(userWith(undefined))).toEqual({
      email: '',
      address: '',
    })
  })
})

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

  const jwtResponse = (overrides: Partial<JwtResponse>): JwtResponse => ({
    access_token: 'a',
    id_token: tokenWithIat,
    expires_in: 3600,
    scope: 's',
    token_type: 'Bearer',
    ...overrides,
  })

  it('uses the exp claim from access_token when expires_at absent', () => {
    expect(
      resolveExpiresAt(
        jwtResponse({
          access_token: tokenWithExp(1_800_000_500),
          expires_in: 120,
        }),
      ),
    ).toBe(1_800_000_500)
  })

  it('prefers the access_token exp over the id_token exp', () => {
    expect(
      resolveExpiresAt(
        jwtResponse({
          access_token: tokenWithExp(1_800_000_111),
          id_token: tokenWithExp(1_800_000_222),
        }),
      ),
    ).toBe(1_800_000_111)
  })

  it('falls back to the id_token exp when access_token has none', () => {
    expect(
      resolveExpiresAt(
        jwtResponse({
          id_token: tokenWithExp(1_800_000_333),
        }),
      ),
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
      resolveExpiresAt(
        jwtResponse({
          access_token: accessToken,
          id_token: idToken,
          expires_in: 300,
        }),
      ),
    ).toBe(1_700_000_000 + 300)
  })

  it('uses Date.now() + expires_in when neither token carries iat', () => {
    const noClaims = new UnsecuredJWT({ sub: 'u1' }).encode()
    expect(
      resolveExpiresAt(
        jwtResponse({
          access_token: noClaims,
          id_token: noClaims,
          expires_in: 300,
        }),
      ),
    ).toBe(
      Math.floor(new Date('2025-06-01T12:00:00.000Z').getTime() / 1000) + 300,
    )
  })

  it('tolerates an opaque (non-JWT) token and falls back to now', () => {
    expect(
      resolveExpiresAt(
        jwtResponse({
          access_token: 'not-a-jwt',
          id_token: 'also-not-a-jwt',
          expires_in: undefined,
        }),
      ),
    ).toBe(Math.floor(new Date('2025-06-01T12:00:00.000Z').getTime() / 1000))
  })

  it('uses expires_at when present', () => {
    expect(
      resolveExpiresAt(
        jwtResponse({
          id_token: 'i',
          expires_at: 1_900_000_000,
        }),
      ),
    ).toBe(1_900_000_000)
  })

  it('uses iat + expires_in when expires_at absent', () => {
    expect(
      resolveExpiresAt(
        jwtResponse({
          expires_in: 120,
        }),
      ),
    ).toBe(1748779000 + 120)
  })

  it('falls back to iat when expires_at and expires_in are not usable numbers', () => {
    expect(
      resolveExpiresAt(
        jwtResponse({
          expires_in: undefined,
        }),
      ),
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

  it('returns null when the zkLogin request throws', async () => {
    vi.mocked(getJwt).mockResolvedValue({
      access_token: 'a',
      id_token: tokenWithClaims,
      expires_in: 3600,
      scope: 's',
      token_type: 'Bearer',
    })
    vi.mocked(getZkLoginAddress).mockRejectedValue(
      new Error('zkLogin address request failed (401): unauthorized'),
    )
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
      address: '0xsui',
      salt: '99',
      publicKey: 'pk',
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
      address: '0xzk',
      salt: '5',
      publicKey: 'pk',
    })

    const user = await getUserForNetwork('sui:testnet')

    expect(getZkLoginAddress).toHaveBeenCalled()
    expect(user?.profile?.sui_address).toBe('0xzk')
  })
})
