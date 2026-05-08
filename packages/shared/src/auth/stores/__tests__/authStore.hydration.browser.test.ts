import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("#/auth/authConfig", () => ({
  getUserManager: vi.fn(() => ({
    getUser: vi.fn(),
    storeUser: vi.fn(),
    removeUser: vi.fn(),
    signinRedirect: vi.fn(),
    signinSilent: vi.fn(),
  })),
  redirectToFusionAuthLogout: vi.fn(),
}));

vi.mock("#/auth/storageService", () => ({
  clearAllJwts: vi.fn().mockResolvedValue(undefined),
  getJwt: vi.fn().mockResolvedValue(null),
}));

vi.mock("#/auth/getZkLoginAddress", () => ({
  clearZkLoginAddressCache: vi.fn(),
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
  zkProofService: { clear: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("#/stores", () => ({
  useContextStore: {
    getState: vi.fn(() => ({ chain: "sui:testnet" })),
  },
  useDeviceStore: {
    getState: vi.fn(() => ({
      networkData: {},
      initializeForChain: vi.fn().mockResolvedValue(undefined),
      lock: vi.fn().mockResolvedValue(undefined),
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
  isExtension: () => false,
  isWeb: () => true,
  performFullCleanup: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("#/utils/tenantConfig", () => ({
  getTenantConfig: vi.fn(() => ({
    serverUrl: "http://localhost",
    clientId: "test-client",
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

import { useAuthStore, waitForAuthHydration } from "#/auth/stores/authStore";

describe("waitForAuthHydration", () => {
  const originalHasHydrated = useAuthStore.persist.hasHydrated;
  const originalOnFinishHydration = useAuthStore.persist.onFinishHydration;
  const originalRehydrate = useAuthStore.persist.rehydrate;

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.persist.hasHydrated = originalHasHydrated;
    useAuthStore.persist.onFinishHydration = originalOnFinishHydration;
    useAuthStore.persist.rehydrate = originalRehydrate;
  });

  it("resolves immediately when the store is already hydrated", async () => {
    const onFinishHydration = vi.fn();
    useAuthStore.persist.hasHydrated = vi.fn(() => true);
    useAuthStore.persist.onFinishHydration = onFinishHydration;

    await waitForAuthHydration();

    expect(onFinishHydration).not.toHaveBeenCalled();
  });

  it("waits for the onFinishHydration event when not yet hydrated", async () => {
    const unsub = vi.fn();
    let finishHydration: (() => void) | undefined;
    useAuthStore.persist.hasHydrated = vi.fn(() => false);
    useAuthStore.persist.onFinishHydration = vi.fn((callback) => {
      finishHydration = callback as () => void;
      return unsub;
    });
    useAuthStore.persist.rehydrate = vi.fn(() => {
      finishHydration?.();
      return Promise.resolve();
    });

    await waitForAuthHydration();

    expect(useAuthStore.persist.onFinishHydration).toHaveBeenCalledTimes(1);
    expect(useAuthStore.persist.rehydrate).toHaveBeenCalledTimes(1);
    expect(unsub).toHaveBeenCalledTimes(1);
  });
});
