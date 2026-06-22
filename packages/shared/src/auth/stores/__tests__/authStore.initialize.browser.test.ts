import { User } from 'oidc-client-ts'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthStoreMockHandles } from './authStoreTestMocks'
import {
  FUTURE,
  makeAdaptersMock,
  makeAuthCleanupMock,
  makeAuthConfigMock,
  makeAuthStoreUtilsMock,
  makeEnvironmentMock,
  makeGetZkLoginAddressMock,
  makeJoseMock,
  makeLoggerMock,
  makeOAuthTokenResponseMock,
  makeStorageServiceMock,
  makeStoredJwt,
  makeStoresMock,
  makeTenantConfigMock,
  makeTenantStoreMock,
  makeUser,
  makeUserJwtSyncMock,
  makeUserToJwtResponseMock,
  makeVaultServiceMock,
  setupAuthStoreMocks,
} from './authStoreTestMocks'

const h: AuthStoreMockHandles = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockStoreUser: vi.fn(),
  mockRemoveUser: vi.fn(),
  mockSigninRedirect: vi.fn(),
  mockSigninSilent: vi.fn(),
  mockGetJwt: vi.fn(),
  mockClearAllJwts: vi.fn(),
  mockEnrichUser: vi.fn(),
  mockSyncPrimaryJwt: vi.fn(),
  mockUserToJwtResponse: vi.fn(),
  mockResolveExpiresAt: vi.fn(),
  mockClearZkLoginAddressCache: vi.fn(),
  mockParseOAuthTokenResponse: vi.fn(),
  mockZkProofClear: vi.fn(),
  mockInitializeForChain: vi.fn(),
  mockDeviceLock: vi.fn(),
  mockGetCurrentTenantId: vi.fn(),
  mockSetCurrentTenantId: vi.fn(),
  mockPerformFullCleanup: vi.fn(),
  mockIsExtension: vi.fn(),
  mockDecodeJwt: vi.fn(),
}))

vi.mock('#/auth/authConfig', () => makeAuthConfigMock(h))
vi.mock('#/auth/storageService', () => makeStorageServiceMock(h))
vi.mock('#/auth/userJwtSync', () => makeUserJwtSyncMock(h))
vi.mock('#/auth/userToJwtResponse', () => makeUserToJwtResponseMock(h))
vi.mock('#/auth/utils/authStoreUtils', () => makeAuthStoreUtilsMock(h))
vi.mock('#/auth/getZkLoginAddress', () =>
  makeGetZkLoginAddressMock(h, { includeGetZkLogin: true }),
)
vi.mock('#/auth/oauthTokenResponse', () => makeOAuthTokenResponseMock(h))
vi.mock('#/services/vaultService', () =>
  makeVaultServiceMock(h, { includeEphKey: true }),
)
vi.mock('#/stores', () => makeStoresMock(h, { withInitializeForChain: false }))
vi.mock('#/stores/tenantStore', () => makeTenantStoreMock(h))
vi.mock('#/utils/environment', () => makeEnvironmentMock(h))
vi.mock('#/utils/logger', () => makeLoggerMock())
vi.mock('#/utils/authCleanup', () => makeAuthCleanupMock(h))
vi.mock('#/utils/tenantConfig', () => makeTenantConfigMock('default'))
vi.mock('#/adapters', () => makeAdaptersMock())
vi.mock('jose', () => makeJoseMock(h))

// ─── import store after mocks ─────────────────────────────────────────────
import { useAuthStore } from '#/auth/stores/authStore'
import { makeJwt } from '#/testing'

// ─── helpers ──────────────────────────────────────────────────────────────

const PAST = Math.floor(Date.now() / 1000) - 60

describe('authStore.initialize() (extension path)', () => {
  let originalChrome: unknown

  beforeEach(() => {
    setupAuthStoreMocks(h, { isExtension: true, tenantId: 'default' })
    h.mockDecodeJwt.mockReturnValue({
      sub: 'user-1',
      iat: 1000,
      exp: FUTURE,
      nonce: 'test-nonce',
    })
    useAuthStore.setState({ user: null, loading: false, error: null })

    originalChrome = (globalThis as unknown as { chrome: unknown }).chrome
    ;(globalThis as unknown as { chrome: unknown }).chrome = {
      runtime: { id: 'test-ext' },
      storage: { local: { get: vi.fn().mockResolvedValue({}) } },
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
    ;(globalThis as unknown as { chrome: unknown }).chrome = originalChrome
  })

  describe('when UserManager has no user', () => {
    beforeEach(() => {
      h.mockGetUser.mockResolvedValue(null)
    })

    it('sets user to null when there is no stored JWT', async () => {
      h.mockGetJwt.mockResolvedValue(null)

      await useAuthStore.getState().initialize()

      expect(useAuthStore.getState().user).toBeNull()
      expect(useAuthStore.getState().loading).toBe(false)
      expect(h.mockStoreUser).not.toHaveBeenCalled()
      expect(h.mockSyncPrimaryJwt).not.toHaveBeenCalled()
    })

    it('rebuilds User from stored JWT and sets it', async () => {
      const storedJwt = makeStoredJwt()
      h.mockGetJwt.mockResolvedValue(storedJwt)
      // Return a valid non-expired snapshot so the expiry check passes
      h.mockUserToJwtResponse.mockReturnValue(storedJwt)
      h.mockResolveExpiresAt.mockReturnValue(FUTURE)

      await useAuthStore.getState().initialize()

      expect(h.mockStoreUser).toHaveBeenCalledOnce()
      expect(h.mockSyncPrimaryJwt).toHaveBeenCalledWith(expect.any(User))
      const { user } = useAuthStore.getState()
      expect(user).toBeInstanceOf(User)
      expect(user?.id_token).toBe(storedJwt.id_token)
      expect(useAuthStore.getState().loading).toBe(false)
    })

    it('sets user to null when stored JWT is expired and no refresh token', async () => {
      h.mockGetJwt.mockResolvedValue(
        makeStoredJwt({ refresh_token: '', expires_at: PAST }),
      )
      h.mockUserToJwtResponse.mockReturnValue(
        makeStoredJwt({ expires_at: PAST }),
      )
      h.mockResolveExpiresAt.mockReturnValue(PAST)

      await useAuthStore.getState().initialize()

      expect(useAuthStore.getState().user).toBeNull()
      expect(useAuthStore.getState().loading).toBe(false)
      expect(h.mockSigninSilent).not.toHaveBeenCalled()
    })

    it('runs silent renew when stored JWT is expired but refresh token is present', async () => {
      const refreshedUser = makeUser({
        id_token: makeJwt({ sub: 'user-1', iat: 2000, exp: FUTURE }),
      })
      h.mockGetJwt.mockResolvedValue(makeStoredJwt({ expires_at: PAST }))
      h.mockUserToJwtResponse.mockReturnValue(
        makeStoredJwt({ expires_at: PAST }),
      )
      h.mockResolveExpiresAt
        .mockReturnValueOnce(PAST) // original user: expired
        .mockReturnValueOnce(FUTURE) // refreshed user: valid
      h.mockSigninSilent.mockResolvedValue(refreshedUser)
      h.mockEnrichUser.mockResolvedValue(refreshedUser)

      await useAuthStore.getState().initialize()

      expect(h.mockSigninSilent).toHaveBeenCalledOnce()
      // storeUser must have been called before signinSilent so the UserManager
      // had the refresh token available when signinSilent() ran.
      expect(h.mockStoreUser).toHaveBeenCalledBefore(h.mockSigninSilent)
      const seededUser = h.mockStoreUser.mock.calls[0][0] as User
      expect(seededUser.refresh_token).toBe('rt')
      expect(useAuthStore.getState().user).toBe(refreshedUser)
      expect(useAuthStore.getState().loading).toBe(false)
    })

    it('calls storeUser with reconstructed user before signinSilent when JWT is expired and refresh token exists', async () => {
      const callOrder: string[] = []
      const refreshedUser = makeUser({
        id_token: makeJwt({ sub: 'user-1', iat: 2000, exp: FUTURE }),
      })
      h.mockGetJwt.mockResolvedValue(makeStoredJwt({ expires_at: PAST }))
      h.mockUserToJwtResponse.mockReturnValue(
        makeStoredJwt({ expires_at: PAST }),
      )
      h.mockResolveExpiresAt
        .mockReturnValueOnce(PAST)
        .mockReturnValueOnce(FUTURE)
      h.mockStoreUser.mockImplementation(async (user: User) => {
        callOrder.push('storeUser')
        // First call must carry the refresh token so signinSilent can use it
        if (callOrder.filter((e) => e === 'storeUser').length === 1) {
          expect(user.refresh_token).toBe('rt')
        }
      })
      h.mockSigninSilent.mockImplementation(async () => {
        callOrder.push('signinSilent')
        return refreshedUser
      })
      h.mockEnrichUser.mockResolvedValue(refreshedUser)

      await useAuthStore.getState().initialize()

      // Full expected sequence: seed expired user → silent renew → persist refreshed user
      expect(callOrder).toEqual(['storeUser', 'signinSilent', 'storeUser'])
      // First storeUser seeded the expired-but-refresh-token-bearing user
      expect(h.mockStoreUser.mock.calls[0][0]).toBeInstanceOf(User)
      expect((h.mockStoreUser.mock.calls[0][0] as User).refresh_token).toBe(
        'rt',
      )
      // Second storeUser persisted the refreshed user (salt stripped from profile)
      expect(h.mockStoreUser.mock.calls[1][0]).toBeInstanceOf(User)
      expect((h.mockStoreUser.mock.calls[1][0] as User).access_token).toBe(
        refreshedUser.access_token,
      )
      expect(h.mockEnrichUser).toHaveBeenCalledWith(
        expect.any(User),
        expect.any(Function),
      )
    })

    it('sets user to null when silent renew fails', async () => {
      h.mockGetJwt.mockResolvedValue(makeStoredJwt({ expires_at: PAST }))
      h.mockUserToJwtResponse.mockReturnValue(
        makeStoredJwt({ expires_at: PAST }),
      )
      h.mockResolveExpiresAt.mockReturnValue(PAST)
      h.mockSigninSilent.mockRejectedValue(new Error('silent renew failed'))

      await useAuthStore.getState().initialize()

      expect(useAuthStore.getState().user).toBeNull()
      expect(useAuthStore.getState().loading).toBe(false)
    })
  })

  describe('when UserManager already has a user', () => {
    it('uses the UserManager user directly without touching the stored JWT', async () => {
      const umUser = makeUser()
      h.mockGetUser.mockResolvedValue(umUser)
      h.mockGetJwt.mockResolvedValue(makeStoredJwt())
      h.mockUserToJwtResponse.mockReturnValue(makeStoredJwt())
      h.mockResolveExpiresAt.mockReturnValue(FUTURE)

      await useAuthStore.getState().initialize()

      expect(h.mockStoreUser).toHaveBeenCalledOnce()
      expect(useAuthStore.getState().user?.id_token).toBe(umUser.id_token)
      expect(useAuthStore.getState().loading).toBe(false)
      // The stored JWT path is never reached — the UserManager user is used directly
      expect(h.mockGetJwt).not.toHaveBeenCalled()
    })
  })

  describe('concurrent initialize() calls', () => {
    beforeEach(() => {
      h.mockGetUser.mockResolvedValue(null)
    })

    it('both calls complete with loading: false and a non-null user', async () => {
      const storedJwt = makeStoredJwt()
      h.mockGetJwt.mockResolvedValue(storedJwt)
      h.mockUserToJwtResponse.mockReturnValue(storedJwt)
      h.mockResolveExpiresAt.mockReturnValue(FUTURE)

      await Promise.all([
        useAuthStore.getState().initialize(),
        useAuthStore.getState().initialize(),
      ])

      expect(useAuthStore.getState().loading).toBe(false)
      expect(useAuthStore.getState().user).not.toBeNull()
      // There is no de-duplication guard: both calls run to completion independently.
      // If a guard is ever added, this count will drop to 1 and the test documents the intent.
      expect(h.mockStoreUser).toHaveBeenCalledTimes(2)
    })
  })
})
