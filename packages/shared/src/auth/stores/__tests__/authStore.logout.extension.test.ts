import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthStoreMockHandles } from './authStoreTestMocks'
import {
  makeAdaptersMock,
  makeAuthConfigMock,
  makeAuthStoreUtilsMock,
  makeGetZkLoginAddressMock,
  makeJoseMock,
  makeOAuthTokenResponseMock,
  makeStorageServiceMock,
  makeStoresMock,
  makeTenantConfigMock,
  makeTenantStoreMock,
  makeUserJwtSyncMock,
  makeUserToJwtResponseMock,
  makeUtilsMock,
  makeVaultServiceMock,
  makeVerifyJwtMock,
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
  mockVerifyIdTokenForTenant: vi.fn(),
}))

vi.mock('#/auth/authConfig', () => makeAuthConfigMock(h))
vi.mock('#/auth/storageService', () => makeStorageServiceMock(h))
vi.mock('#/auth/userJwtSync', () => makeUserJwtSyncMock(h))
vi.mock('#/auth/userToJwtResponse', () => makeUserToJwtResponseMock(h))
vi.mock('#/auth/utils/authStoreUtils', () => makeAuthStoreUtilsMock(h))
vi.mock('#/auth/getZkLoginAddress', () => makeGetZkLoginAddressMock(h))
vi.mock('#/auth/oauthTokenResponse', () => makeOAuthTokenResponseMock(h))
vi.mock('#/services/vaultService', () => makeVaultServiceMock(h))
vi.mock('#/stores', () => makeStoresMock(h))
vi.mock('#/stores/tenantStore', () => makeTenantStoreMock(h))
vi.mock('#/utils', () => makeUtilsMock(h))
vi.mock('#/utils/tenantConfig', () =>
  makeTenantConfigMock('stillness', {
    serverUrl: 'https://auth.example.test/',
    clientId: 'client-1',
  }),
)
vi.mock('#/adapters', () => makeAdaptersMock())
vi.mock('jose', () => makeJoseMock(h))
vi.mock('#/auth/verifyJwt', () => makeVerifyJwtMock(h))

import { useAuthStore } from '#/auth/stores/authStore'

describe('authStore.logout() extension path', () => {
  const getRedirectURL = vi.fn()
  const launchWebAuthFlow = vi.fn()
  const sendMessage = vi.fn()

  beforeEach(() => {
    setupAuthStoreMocks(h, { isExtension: true })
    getRedirectURL.mockReturnValue('chrome-extension://extension-id/callback')
    launchWebAuthFlow.mockResolvedValue(undefined)
    vi.stubGlobal('browser', {
      identity: {
        getRedirectURL,
        launchWebAuthFlow,
      },
      runtime: {
        id: 'extension-id',
        sendMessage,
      },
    })
    useAuthStore.setState({ user: null, loading: false, error: null })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('launches FusionAuth logout and emits an empty accounts change after completion', async () => {
    await useAuthStore.getState().logout()

    expect(getRedirectURL).toHaveBeenCalledOnce()
    expect(launchWebAuthFlow).toHaveBeenCalledWith({
      url: expect.any(String),
      interactive: true,
    })

    const [{ url }] = launchWebAuthFlow.mock.calls[0]
    const logoutUrl = new URL(url)
    expect(logoutUrl.origin).toBe('https://auth.example.test')
    expect(logoutUrl.pathname).toBe('/oauth2/logout')
    expect(logoutUrl.searchParams.get('client_id')).toBe('client-1')
    expect(logoutUrl.searchParams.get('post_logout_redirect_uri')).toBe(
      'chrome-extension://extension-id/callback',
    )
    // The empty-accounts change is broadcast from the launchWebAuthFlow
    // promise's .then, so it lands a microtask after logout() resolves.
    await vi.waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith({
        __from: 'Eve Vault',
        event: 'change',
        payload: { accounts: [] },
      }),
    )
  })
})
