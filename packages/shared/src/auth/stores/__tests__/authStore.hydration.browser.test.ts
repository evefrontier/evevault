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
vi.mock('#/auth/getZkLoginAddress', () => makeGetZkLoginAddressMock(h))
vi.mock('#/auth/oauthTokenResponse', () => makeOAuthTokenResponseMock(h))
vi.mock('#/services/vaultService', () => makeVaultServiceMock(h))
vi.mock('#/stores', () => makeStoresMock(h))
vi.mock('#/stores/tenantStore', () => makeTenantStoreMock(h))
vi.mock('#/utils', () => makeUtilsMock(h))
vi.mock('#/utils/tenantConfig', () => makeTenantConfigMock())
vi.mock('#/adapters', () => makeAdaptersMock())
vi.mock('jose', () => makeJoseMock(h))

import { useAuthStore, waitForAuthHydration } from '#/auth/stores/authStore'

describe('waitForAuthHydration', () => {
  const originalHasHydrated = useAuthStore.persist.hasHydrated
  const originalOnFinishHydration = useAuthStore.persist.onFinishHydration
  const originalRehydrate = useAuthStore.persist.rehydrate

  beforeEach(() => {
    setupAuthStoreMocks(h)
    useAuthStore.persist.hasHydrated = originalHasHydrated
    useAuthStore.persist.onFinishHydration = originalOnFinishHydration
    useAuthStore.persist.rehydrate = originalRehydrate
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('resolves immediately when the store is already hydrated', async () => {
    const onFinishHydration = vi.fn()
    useAuthStore.persist.hasHydrated = vi.fn(() => true)
    useAuthStore.persist.onFinishHydration = onFinishHydration

    await waitForAuthHydration()

    expect(onFinishHydration).not.toHaveBeenCalled()
  })

  it('waits for the onFinishHydration event when not yet hydrated', async () => {
    const unsub = vi.fn()
    let finishHydration: (() => void) | undefined
    useAuthStore.persist.hasHydrated = vi.fn(() => false)
    useAuthStore.persist.onFinishHydration = vi.fn((callback) => {
      finishHydration = callback as () => void
      return unsub
    })
    useAuthStore.persist.rehydrate = vi.fn(() => {
      finishHydration?.()
      return Promise.resolve()
    })

    await waitForAuthHydration()

    expect(useAuthStore.persist.onFinishHydration).toHaveBeenCalledOnce()
    expect(useAuthStore.persist.rehydrate).toHaveBeenCalledOnce()
    expect(unsub).toHaveBeenCalledOnce()
  })
})
