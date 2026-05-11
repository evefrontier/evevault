import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRemoveUser,
  mockClearAllJwts,
  mockClearZkLoginAddressCache,
  mockPerformFullCleanup,
  mockZkProofClear,
  mockDeviceLock,
} = vi.hoisted(() => ({
  mockRemoveUser: vi.fn(),
  mockClearAllJwts: vi.fn(),
  mockClearZkLoginAddressCache: vi.fn(),
  mockPerformFullCleanup: vi.fn(),
  mockZkProofClear: vi.fn(),
  mockDeviceLock: vi.fn(),
}));

vi.mock("#/auth/authConfig", () => ({
  getUserManager: vi.fn(() => ({
    getUser: vi.fn(),
    storeUser: vi.fn(),
    removeUser: mockRemoveUser,
    signinRedirect: vi.fn(),
    signinSilent: vi.fn(),
  })),
  redirectToFusionAuthLogout: vi.fn(),
}));

vi.mock("#/auth/storageService", () => ({
  clearAllJwts: (...args: unknown[]) => mockClearAllJwts(...args),
  getJwt: vi.fn().mockResolvedValue(null),
}));

vi.mock("#/auth/getZkLoginAddress", () => ({
  clearZkLoginAddressCache: (...args: unknown[]) =>
    mockClearZkLoginAddressCache(...args),
}));

vi.mock("#/auth/oauthTokenResponse", () => ({
  parseOAuthTokenResponse: vi.fn(),
}));

vi.mock("#/auth/userJwtSync", () => ({
  enrichUserWithZkLoginIfNeeded: vi.fn(async (user) => user),
  syncPrimaryJwtFromUser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("#/auth/userToJwtResponse", () => ({
  userToJwtResponse: vi.fn(),
}));

vi.mock("#/auth/utils/authStoreUtils", () => ({
  resolveExpiresAt: vi.fn(),
}));

vi.mock("#/services/vaultService", () => ({
  zkProofService: {
    clear: (...args: unknown[]) => mockZkProofClear(...args),
  },
}));

vi.mock("#/stores", () => ({
  useContextStore: {
    getState: vi.fn(() => ({ chain: "sui:testnet" })),
  },
  useDeviceStore: {
    getState: vi.fn(() => ({
      networkData: {},
      initializeForChain: vi.fn().mockResolvedValue(undefined),
      lock: mockDeviceLock,
    })),
  },
}));

vi.mock("#/stores/tenantStore", () => ({
  getCurrentTenantId: vi.fn(() => "stillness"),
  OAuthTenantSessionKey: "evevault_oauth_tenant",
  setCurrentTenantId: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("#/utils", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  isBrowser: () => true,
  isExtension: () => true,
  isWeb: () => false,
  performFullCleanup: (...args: unknown[]) => mockPerformFullCleanup(...args),
}));

vi.mock("#/utils/tenantConfig", () => ({
  getTenantConfig: vi.fn(() => ({
    serverUrl: "https://auth.example.test/",
    clientId: "client-1",
  })),
  DEFAULT_TENANT_ID: "stillness",
}));

vi.mock("#/adapters", () => ({
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
}));

vi.mock("jose", () => ({
  decodeJwt: vi.fn(),
}));

import { useAuthStore } from "#/auth/stores/authStore";

describe("authStore.logout() extension path", () => {
  const getRedirectURL = vi.fn();
  const launchWebAuthFlow = vi.fn();
  const sendMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockRemoveUser.mockResolvedValue(undefined);
    mockClearAllJwts.mockResolvedValue(undefined);
    mockPerformFullCleanup.mockResolvedValue(undefined);
    mockZkProofClear.mockResolvedValue(undefined);
    mockDeviceLock.mockResolvedValue(undefined);
    getRedirectURL.mockReturnValue("chrome-extension://extension-id/callback");
    launchWebAuthFlow.mockImplementation((_, callback) => callback?.());
    vi.stubGlobal("chrome", {
      identity: {
        getRedirectURL,
        launchWebAuthFlow,
      },
      runtime: {
        id: "extension-id",
        sendMessage,
      },
    });
    useAuthStore.setState({ user: null, loading: false, error: null });
  });

  it("launches FusionAuth logout and emits an empty accounts change after completion", async () => {
    await useAuthStore.getState().logout();

    expect(getRedirectURL).toHaveBeenCalledTimes(1);
    expect(launchWebAuthFlow).toHaveBeenCalledWith(
      { url: expect.any(String), interactive: true },
      expect.any(Function),
    );

    const [{ url }] = launchWebAuthFlow.mock.calls[0];
    const logoutUrl = new URL(url);
    expect(logoutUrl.origin).toBe("https://auth.example.test");
    expect(logoutUrl.pathname).toBe("/oauth2/logout");
    expect(logoutUrl.searchParams.get("client_id")).toBe("client-1");
    expect(logoutUrl.searchParams.get("post_logout_redirect_uri")).toBe(
      "chrome-extension://extension-id/callback",
    );
    expect(sendMessage).toHaveBeenCalledWith({
      __from: "Eve Vault",
      event: "change",
      payload: { accounts: [] },
    });
  });
});
