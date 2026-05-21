import { User, type UserManager } from 'oidc-client-ts'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  mockStoreUser: vi.fn(),
  mockEnrichUser: vi.fn(),
  mockSyncPrimaryJwt: vi.fn(),
  mockUserToJwtResponse: vi.fn(),
  mockResolveExpiresAt: vi.fn(),
  mockDecodeJwt: vi.fn(),
}))

vi.mock('#/auth/userJwtSync', () => ({
  enrichUserWithZkLoginIfNeeded: (...args: unknown[]) =>
    h.mockEnrichUser(...args),
  syncPrimaryJwtFromUser: (...args: unknown[]) => h.mockSyncPrimaryJwt(...args),
}))
vi.mock('#/auth/userToJwtResponse', () => ({
  userToJwtResponse: (...args: unknown[]) => h.mockUserToJwtResponse(...args),
}))
vi.mock('#/auth/utils/authStoreUtils', () => ({
  resolveExpiresAt: (...args: unknown[]) => h.mockResolveExpiresAt(...args),
}))
vi.mock('#/utils', () => ({
  isBrowser: () => true,
}))
vi.mock('jose', () => ({
  decodeJwt: (...args: unknown[]) => h.mockDecodeJwt(...args),
}))

import {
  buildUserFromJwt,
  buildUserFromOAuthResponse,
  jwtTiming,
  persistEnrichedUser,
} from '#/auth/stores/authUserSession'
import { makeJwt } from '#/testing'
import type { JwtResponse, OAuthTokenResponse } from '#/types/authTypes'
import { MOCK_ID_TOKEN_CLAIMS } from './authStoreTestMocks'

function makeJwtResponse(overrides: Partial<JwtResponse> = {}): JwtResponse {
  return {
    id_token: makeJwt(MOCK_ID_TOKEN_CLAIMS),
    access_token: 'access-token',
    token_type: 'Bearer',
    scope: 'openid',
    refresh_token: 'refresh-token',
    expires_in: 3600,
    ...overrides,
  }
}

describe('Build user from JWT', () => {
  let mockUserManager: Pick<UserManager, 'storeUser'>

  beforeEach(() => {
    h.mockStoreUser.mockResolvedValue(undefined)
    h.mockEnrichUser.mockImplementation(async (user: unknown) => user)
    h.mockSyncPrimaryJwt.mockResolvedValue(undefined)
    h.mockDecodeJwt.mockReturnValue(MOCK_ID_TOKEN_CLAIMS)
    h.mockUserToJwtResponse.mockReturnValue(makeJwtResponse())
    h.mockResolveExpiresAt.mockReturnValue(4600)
    mockUserManager = { storeUser: h.mockStoreUser }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Success path', () => {
    it('uses decoded JWT as profile', () => {
      const user = buildUserFromJwt(makeJwtResponse())

      expect(user.profile.sub).toBe('user-1')
    })

    it("defaults token_type to 'Bearer' and scope to ''", () => {
      const jwt = {
        ...makeJwtResponse(),
        token_type: undefined as unknown as string,
        scope: undefined as unknown as string,
      }

      const user = buildUserFromJwt(jwt)

      expect(user.token_type).toBe('Bearer')
      expect(user.scope).toBe('')
    })

    it('ignores response expires_at and computes expires_at from iat + expires_in', () => {
      const oauthResponse: OAuthTokenResponse = {
        ...makeJwtResponse(),
        refresh_token: 'refresh-token',
        // Deliberately different from decoded iat (1000) + expires_in (3600)
        // to prove buildUserFromOAuthResponse ignores response expires_at.
        expires_at: 9999,
      }

      const user = buildUserFromOAuthResponse(oauthResponse)

      // mockDecodeJwt supplies iat: 1000, makeJwtResponse supplies expires_in: 3600
      // => computed expires_at is 4600.
      expect(user.expires_at).toBe(4600)
    })

    it('returns { expiresAt, now } when a JWT snapshot exists', () => {
      const user = buildUserFromJwt(makeJwtResponse())
      const result = jwtTiming(user)

      expect(result).toEqual({ expiresAt: 4600, now: expect.any(Number) })
    })

    it('stores/syncs the enriched user, not the original user', async () => {
      const originalUser = buildUserFromJwt(makeJwtResponse())
      const enrichedUser = new User({
        id_token: makeJwt({ sub: 'user-1', zkLoginAddress: '0xenriched' }),
        access_token: 'enriched-access',
        token_type: 'Bearer',
        scope: 'openid',
        profile: {
          sub: 'user-1',
          sui_address: '0xenriched',
          salt: 'mock-salt',
        } as unknown as User['profile'],
      })
      h.mockEnrichUser.mockResolvedValue(enrichedUser)

      const result = await persistEnrichedUser(
        originalUser,
        mockUserManager as unknown as UserManager,
      )

      expect(result).toBe(enrichedUser)
      expect(h.mockStoreUser).toHaveBeenCalledWith(enrichedUser)
      expect(h.mockSyncPrimaryJwt).toHaveBeenCalledWith(enrichedUser)
    })
  })

  describe('Rejection paths', () => {
    it('jwtTiming returns null when userToJwtResponse() returns null', () => {
      h.mockUserToJwtResponse.mockReturnValue(null)

      // Create a real user but no JWT snapshot to test jwtTiming's null return.
      const user = buildUserFromJwt(makeJwtResponse())

      // Without a JWT snapshot, expiry timing is unavailable,
      // so jwtTiming returns null.
      expect(jwtTiming(user)).toBeNull()
    })
  })
})
