import { User } from 'oidc-client-ts'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeJwt } from '#/testing'

const mockGetZkLoginAddress = vi.fn()
const mockStoreJwt = vi.fn()
const mockWarn = vi.fn()

vi.mock('#/auth/getZkLoginAddress', () => ({
  getZkLoginAddress: (...args: unknown[]) => mockGetZkLoginAddress(...args),
}))

vi.mock('#/auth/storageService', () => ({
  storeJwt: (...args: unknown[]) => mockStoreJwt(...args),
}))

vi.mock('#/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: mockWarn,
    error: vi.fn(),
  }),
}))
function baseUser(overrides: Partial<ConstructorParameters<typeof User>[0]>) {
  return new User({
    id_token: makeJwt({ sub: 'user-1', exp: 4_000_000_000 }),
    access_token: 'access',
    token_type: 'Bearer',
    scope: 'openid',
    refresh_token: 'refresh-1',
    profile: { sub: 'user-1' } as User['profile'],
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  })
}

describe('enrichUserWithZkLoginIfNeeded', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns the same user when id_token is missing', async () => {
    const { enrichUserWithZkLoginIfNeeded } = await import('#/auth/userJwtSync')
    const user = baseUser({ id_token: undefined })

    const out = await enrichUserWithZkLoginIfNeeded(user)

    expect(out).toBe(user)
    expect(mockGetZkLoginAddress).not.toHaveBeenCalled()
  })

  it('returns the same user when profile has both sui_address and salt', async () => {
    const { enrichUserWithZkLoginIfNeeded } = await import('#/auth/userJwtSync')
    const user = baseUser({
      profile: {
        sub: 'user-1',
        sui_address: '0xsui',
        salt: 'salt-abc',
      } as unknown as User['profile'],
    })

    const out = await enrichUserWithZkLoginIfNeeded(user)

    expect(out).toBe(user)
    expect(mockGetZkLoginAddress).not.toHaveBeenCalled()
  })

  it('re-derives salt when sui_address is present but salt is missing (stripped from sessionStorage)', async () => {
    const { enrichUserWithZkLoginIfNeeded } = await import('#/auth/userJwtSync')
    mockGetZkLoginAddress.mockResolvedValue({
      address: '0xsui',
      salt: 'salt-re-derived',
      publicKey: 'pk',
    })
    const user = baseUser({
      profile: {
        sub: 'user-1',
        sui_address: '0xsui',
      } as unknown as User['profile'],
    })

    const out = await enrichUserWithZkLoginIfNeeded(user)

    expect(mockGetZkLoginAddress).toHaveBeenCalledOnce()
    expect(out.profile?.salt).toBe('salt-re-derived')
  })

  it('fetches and merges sui_address and salt when sui_address is missing', async () => {
    const { enrichUserWithZkLoginIfNeeded } = await import('#/auth/userJwtSync')
    mockGetZkLoginAddress.mockResolvedValue({
      address: '0xenoki',
      salt: 'salt-99',
      publicKey: 'pk',
    })

    const user = baseUser({
      profile: { sub: 'user-1' } as User['profile'],
    })

    const out = await enrichUserWithZkLoginIfNeeded(user)

    expect(mockGetZkLoginAddress).toHaveBeenCalledWith({
      jwt: user.id_token,
    })
    expect(out).not.toBe(user)
    expect(out.profile?.sui_address).toBe('0xenoki')
    expect(out.profile?.salt).toBe('salt-99')
  })

  it('propagates the error when the zkLogin address request fails', async () => {
    const { enrichUserWithZkLoginIfNeeded } = await import('#/auth/userJwtSync')
    mockGetZkLoginAddress.mockRejectedValue(
      new Error('zkLogin address request failed (401): unauthorized'),
    )

    const user = baseUser({})

    await expect(enrichUserWithZkLoginIfNeeded(user)).rejects.toThrow(
      /failed \(401\)/,
    )
  })
})

describe('syncPrimaryJwtFromUser', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('warns and skips storeJwt when refresh_token is missing', async () => {
    const { syncPrimaryJwtFromUser } = await import('#/auth/userJwtSync')
    const user = baseUser({ refresh_token: undefined })

    await syncPrimaryJwtFromUser(user)

    expect(mockWarn).toHaveBeenCalledWith(
      '[syncPrimaryJwtFromUser] no refresh token, skipping evevault:jwt mirror',
    )
    expect(mockStoreJwt).not.toHaveBeenCalled()
  })

  it('warns and skips storeJwt when refresh_token is blank', async () => {
    const { syncPrimaryJwtFromUser } = await import('#/auth/userJwtSync')
    const user = baseUser({ refresh_token: '   ' })

    await syncPrimaryJwtFromUser(user)

    expect(mockWarn).toHaveBeenCalled()
    expect(mockStoreJwt).not.toHaveBeenCalled()
  })

  it('calls storeJwt with OAuth payload when refresh_token is present', async () => {
    const { syncPrimaryJwtFromUser } = await import('#/auth/userJwtSync')
    const user = baseUser({})

    await syncPrimaryJwtFromUser(user)

    expect(mockWarn).not.toHaveBeenCalled()
    expect(mockStoreJwt).toHaveBeenCalledOnce()
    const [jwtArg] = mockStoreJwt.mock.calls[0] ?? []
    expect(jwtArg).toMatchObject({
      id_token: user.id_token,
      access_token: 'access',
      refresh_token: 'refresh-1',
    })
  })
})
