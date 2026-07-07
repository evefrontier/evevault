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

describe('authStore.initialize() (web path)', () => {
  beforeEach(() => {
    setupAuthStoreMocks(h, { tenantId: 'default' })
    useAuthStore.setState({ user: null, loading: false, error: null })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('sets user to webUser directly when the token is valid and salt is present', async () => {
    const user = makeUser({
      profile: {
        sub: 'user-1',
        sui_address: '0xsui',
        salt: 'abc',
      } as unknown as User['profile'],
    })
    h.mockGetUser.mockResolvedValue(user)
    h.mockUserToJwtResponse.mockReturnValue(makeStoredJwt())
    h.mockResolveExpiresAt.mockReturnValue(FUTURE)

    await useAuthStore.getState().initialize()

    expect(useAuthStore.getState().user).toBe(user)
    expect(useAuthStore.getState().loading).toBe(false)
    expect(h.mockSigninSilent).not.toHaveBeenCalled()
    expect(h.mockEnrichUser).not.toHaveBeenCalled()
  })

  it('re-enriches via Enoki when the token is valid but salt was stripped from sessionStorage', async () => {
    const user = makeUser({
      profile: {
        sub: 'user-1',
        sui_address: '0xsui',
      } as unknown as User['profile'],
    })
    h.mockGetUser.mockResolvedValue(user)
    h.mockUserToJwtResponse.mockReturnValue(makeStoredJwt())
    h.mockResolveExpiresAt.mockReturnValue(FUTURE)

    await useAuthStore.getState().initialize()

    expect(h.mockEnrichUser).toHaveBeenCalledOnce()
    expect(h.mockStoreUser).toHaveBeenCalledOnce()
    expect(h.mockSyncPrimaryJwt).toHaveBeenCalledOnce()
    expect(useAuthStore.getState().loading).toBe(false)
    expect(h.mockSigninSilent).not.toHaveBeenCalled()
  })

  describe('when the token is expired', () => {
    beforeEach(() => {
      h.mockUserToJwtResponse.mockReturnValue(
        makeStoredJwt({ expires_at: PAST }),
      )
      h.mockResolveExpiresAt.mockReturnValue(PAST)
    })

    it('sets user to null when there is no refresh token', async () => {
      h.mockGetUser.mockResolvedValue(makeUser({ refresh_token: '' }))

      await useAuthStore.getState().initialize()

      expect(useAuthStore.getState().user).toBeNull()
      expect(useAuthStore.getState().loading).toBe(false)
      expect(h.mockSigninSilent).not.toHaveBeenCalled()
    })

    it('sets user to null when the refresh token is whitespace only', async () => {
      h.mockGetUser.mockResolvedValue(makeUser({ refresh_token: '   ' }))

      await useAuthStore.getState().initialize()

      expect(useAuthStore.getState().user).toBeNull()
      expect(h.mockSigninSilent).not.toHaveBeenCalled()
    })

    it('runs silent renew and sets the refreshed user', async () => {
      const refreshed = makeUser({
        id_token: makeJwt({ sub: 'user-1', iat: 2000, exp: FUTURE }),
      })
      h.mockGetUser.mockResolvedValue(makeUser())
      h.mockSigninSilent.mockResolvedValue(refreshed)
      h.mockEnrichUser.mockResolvedValue(refreshed)

      await useAuthStore.getState().initialize()

      expect(h.mockSigninSilent).toHaveBeenCalledOnce()
      expect(h.mockEnrichUser).toHaveBeenCalledWith(expect.any(User))
      expect(h.mockStoreUser).toHaveBeenCalledWith(refreshed)
      expect(h.mockSyncPrimaryJwt).toHaveBeenCalledWith(refreshed)
      expect(useAuthStore.getState().user).toBe(refreshed)
      expect(useAuthStore.getState().loading).toBe(false)
    })

    it('sets user to null when silent renew returns null', async () => {
      h.mockGetUser.mockResolvedValue(makeUser())
      h.mockSigninSilent.mockResolvedValue(null)

      await useAuthStore.getState().initialize()

      expect(useAuthStore.getState().user).toBeNull()
      expect(useAuthStore.getState().loading).toBe(false)
      expect(h.mockStoreUser).not.toHaveBeenCalled()
    })

    it('sets user to null when silent renew throws', async () => {
      h.mockGetUser.mockResolvedValue(makeUser())
      h.mockSigninSilent.mockRejectedValue(new Error('network error'))

      await useAuthStore.getState().initialize()

      expect(useAuthStore.getState().user).toBeNull()
      expect(useAuthStore.getState().loading).toBe(false)
    })
  })

  it('sets user to null when getUser returns null (no JWT to inspect)', async () => {
    h.mockGetUser.mockResolvedValue(null)
    h.mockUserToJwtResponse.mockReturnValue(null)

    await useAuthStore.getState().initialize()

    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().loading).toBe(false)
    expect(h.mockSigninSilent).not.toHaveBeenCalled()
  })
})
