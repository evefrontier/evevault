import { SUI_TESTNET_CHAIN } from '@mysten/wallet-standard';
import type { Mock } from 'vitest';
import { vi } from 'vitest';
import { makeJwt } from '#/testing';
import type { OAuthTokenResponse } from '#/types/authTypes';

/**
 * All mock handles shared across authStore test files.
 * Create with a vi.hoisted() block in each test file — see usage below.
 *
 * Usage in a test file:
 * ```ts
 * import type { AuthStoreMockHandles } from "./authStoreTestMocks";
 * import { makeAuthConfigMock, setupAuthStoreMocks, ... } from "./authStoreTestMocks";
 *
 * const h: AuthStoreMockHandles = vi.hoisted(() => ({
 *   mockGetUser: vi.fn(), mockStoreUser: vi.fn(), ... (all handles)
 * }));
 *
 * vi.mock("#/auth/authConfig", () => makeAuthConfigMock(h));
 * // ... one line per mocked module
 *
 * beforeEach(() => {
 *   vi.clearAllMocks();
 *   setupAuthStoreMocks(h, { isExtension: false });
 *   useAuthStore.setState({ user: null, loading: false, error: null });
 * });
 * ```
 */
export type AuthStoreMockHandles = {
  mockIsExtension: Mock;
  mockDecodeJwt: Mock;
  mockGetUser: Mock;
  mockStoreUser: Mock;
  mockRemoveUser: Mock;
  mockSigninRedirect: Mock;
  mockSigninSilent: Mock;
  mockGetJwt: Mock;
  mockClearAllJwts: Mock;
  mockEnrichUser: Mock;
  mockSyncPrimaryJwt: Mock;
  mockUserToJwtResponse: Mock;
  mockResolveExpiresAt: Mock;
  mockClearZkLoginAddressCache: Mock;
  mockParseOAuthTokenResponse: Mock;
  mockZkProofClear: Mock;
  mockInitializeForChain: Mock;
  mockDeviceLock: Mock;
  mockGetCurrentTenantId: Mock;
  mockSetCurrentTenantId: Mock;
  mockPerformFullCleanup: Mock;
};

// ─── vi.mock() factory functions ──────────────────────────────────────────
// Each returns the mock module object. Use as:
//   vi.mock("#/auth/authConfig", () => makeAuthConfigMock(h));
// The lazy `() =>` wrapper in vi.mock() ensures these run after imports resolve.

export function makeAuthConfigMock(h: AuthStoreMockHandles) {
  return {
    getUserManager: vi.fn(() => ({
      getUser: (...args: unknown[]) => h.mockGetUser(...args),
      storeUser: (...args: unknown[]) => h.mockStoreUser(...args),
      removeUser: (...args: unknown[]) => h.mockRemoveUser(...args),
      signinRedirect: (...args: unknown[]) => h.mockSigninRedirect(...args),
      signinSilent: (...args: unknown[]) => h.mockSigninSilent(...args),
    })),
    redirectToFusionAuthLogout: vi.fn(),
  };
}

export function makeStorageServiceMock(h: AuthStoreMockHandles) {
  return {
    clearAllJwts: (...args: unknown[]) => h.mockClearAllJwts(...args),
    getJwt: (...args: unknown[]) => h.mockGetJwt(...args),
  };
}

export function makeUserJwtSyncMock(h: AuthStoreMockHandles) {
  return {
    enrichUserWithZkLoginIfNeeded: (...args: unknown[]) =>
      h.mockEnrichUser(...args),
    syncPrimaryJwtFromUser: (...args: unknown[]) =>
      h.mockSyncPrimaryJwt(...args),
  };
}

export function makeUserToJwtResponseMock(h: AuthStoreMockHandles) {
  return {
    userToJwtResponse: (...args: unknown[]) => h.mockUserToJwtResponse(...args),
  };
}

export function makeAuthStoreUtilsMock(h: AuthStoreMockHandles) {
  return {
    resolveExpiresAt: (...args: unknown[]) => h.mockResolveExpiresAt(...args),
  };
}

export type GetZkLoginAddressMockOptions = { includeGetZkLogin?: boolean };

export function makeGetZkLoginAddressMock(
  h: AuthStoreMockHandles,
  opts: GetZkLoginAddressMockOptions = {},
) {
  return {
    clearZkLoginAddressCache: (...args: unknown[]) =>
      h.mockClearZkLoginAddressCache(...args),
    ...(opts.includeGetZkLogin && { getZkLoginAddress: vi.fn() }),
  };
}

export function makeOAuthTokenResponseMock(h: AuthStoreMockHandles) {
  return {
    parseOAuthTokenResponse: (...args: unknown[]) =>
      h.mockParseOAuthTokenResponse(...args),
  };
}

export type VaultServiceMockOptions = { includeEphKey?: boolean };

export function makeVaultServiceMock(
  h: AuthStoreMockHandles,
  opts: VaultServiceMockOptions = {},
) {
  return {
    zkProofService: {
      clear: (...args: unknown[]) => h.mockZkProofClear(...args),
    },
    ...(opts.includeEphKey && {
      ephKeyService: { lock: vi.fn().mockResolvedValue(undefined) },
    }),
  };
}

export type StoresMockOptions = { withInitializeForChain?: boolean };

export function makeStoresMock(
  h: AuthStoreMockHandles,
  opts: StoresMockOptions = { withInitializeForChain: true },
) {
  return {
    useContextStore: {
      getState: vi.fn(() => ({ chain: SUI_TESTNET_CHAIN })),
    },
    useDeviceStore: {
      getState: vi.fn(() => ({
        networkData: {},
        ...(opts.withInitializeForChain && {
          initializeForChain: (...args: unknown[]) =>
            h.mockInitializeForChain(...args),
        }),
        lock: (...args: unknown[]) => h.mockDeviceLock(...args),
      })),
    },
  };
}

export function makeTenantStoreMock(h: AuthStoreMockHandles) {
  return {
    getCurrentTenantId: () => h.mockGetCurrentTenantId(),
    OAuthTenantSessionKey: 'evevault_oauth_tenant',
    setCurrentTenantId: (...args: unknown[]) =>
      h.mockSetCurrentTenantId(...args),
  };
}

/** Mocks `#/utils` barrel — isExtension, isWeb, isBrowser, createLogger, performFullCleanup. */
export function makeUtilsMock(h: AuthStoreMockHandles) {
  return {
    createLogger: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
    isBrowser: () => true,
    isExtension: () => h.mockIsExtension(),
    isWeb: () => !h.mockIsExtension(),
    performFullCleanup: (...args: unknown[]) =>
      h.mockPerformFullCleanup(...args),
  };
}

/** Mocks `#/utils/environment` sub-module (used by initialize tests). */
export function makeEnvironmentMock(h: AuthStoreMockHandles) {
  return {
    isExtension: () => h.mockIsExtension(),
    isWeb: () => !h.mockIsExtension(),
    isBrowser: () => true,
  };
}

/** Mocks `#/utils/logger` sub-module (used by initialize tests). */
export function makeLoggerMock() {
  return {
    createLogger: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  };
}

/** Mocks `#/utils/authCleanup` sub-module (used by initialize tests). */
export function makeAuthCleanupMock(h: AuthStoreMockHandles) {
  return {
    performFullCleanup: (...args: unknown[]) =>
      h.mockPerformFullCleanup(...args),
  };
}

export function makeJoseMock(h: AuthStoreMockHandles) {
  return {
    decodeJwt: (...args: unknown[]) => h.mockDecodeJwt(...args),
  };
}

export function makeAdaptersMock() {
  return {
    localStorageAdapter: {
      getItem: vi.fn().mockResolvedValue(null),
      setItem: vi.fn().mockResolvedValue(undefined),
      removeItem: vi.fn().mockResolvedValue(undefined),
    },
    chromeStorageAdapter: {
      getItem: vi.fn().mockResolvedValue(null),
      setItem: vi.fn().mockResolvedValue(undefined),
      removeItem: vi.fn().mockResolvedValue(undefined),
    },
  };
}

export function makeTenantConfigMock(
  tenantId = 'stillness',
  config: { serverUrl?: string; clientId?: string } = {},
) {
  const { serverUrl = 'http://localhost', clientId = 'test-client' } = config;
  return {
    getTenantConfig: vi.fn(() => ({ serverUrl, clientId })),
    DEFAULT_TENANT_ID: tenantId,
  };
}

export type SetupAuthStoreMocksOptions = {
  isExtension?: boolean;
  tenantId?: string;
};

/** Call in `beforeEach` (after `vi.clearAllMocks()`) to reset all handles to safe defaults. */
export function setupAuthStoreMocks(
  h: AuthStoreMockHandles,
  options: SetupAuthStoreMocksOptions = {},
) {
  const { isExtension = false, tenantId = 'stillness' } = options;
  h.mockIsExtension.mockReturnValue(isExtension);
  h.mockGetCurrentTenantId.mockReturnValue(tenantId);
  h.mockGetJwt.mockResolvedValue(null);
  h.mockClearAllJwts.mockResolvedValue(undefined);
  h.mockEnrichUser.mockImplementation(async (user: unknown) => user);
  h.mockSyncPrimaryJwt.mockResolvedValue(undefined);
  h.mockStoreUser.mockResolvedValue(undefined);
  h.mockRemoveUser.mockResolvedValue(undefined);
  h.mockSigninRedirect.mockResolvedValue(undefined);
  h.mockSigninSilent.mockResolvedValue(undefined);
  h.mockInitializeForChain.mockResolvedValue(undefined);
  h.mockDeviceLock.mockResolvedValue(undefined);
  h.mockClearZkLoginAddressCache.mockResolvedValue(undefined);
  h.mockZkProofClear.mockResolvedValue(undefined);
  h.mockPerformFullCleanup.mockResolvedValue(undefined);
  h.mockSetCurrentTenantId.mockResolvedValue(undefined);
  h.mockDecodeJwt.mockReturnValue({
    sub: 'user-1',
    iat: 1000,
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
}

export const MOCK_ID_TOKEN_CLAIMS = {
  sub: 'user-1',
  iat: 1000,
  exp: 4600,
} as const;

export function makeTokenResponse(): OAuthTokenResponse {
  return {
    id_token: makeJwt(MOCK_ID_TOKEN_CLAIMS),
    access_token: 'access-token',
    token_type: 'Bearer',
    scope: 'openid',
    refresh_token: 'refresh-token',
    expires_in: 3600,
    expires_at: 4600,
  };
}
