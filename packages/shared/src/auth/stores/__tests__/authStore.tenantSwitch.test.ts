import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRemoveUser,
  mockPerformFullCleanup,
  mockClearAllJwts,
  mockClearZkLoginAddressCache,
  mockZkProofClear,
  mockDeviceLock,
  mockGetCurrentTenantId,
  mockSetCurrentTenantId,
} = vi.hoisted(() => ({
  mockRemoveUser: vi.fn(),
  mockPerformFullCleanup: vi.fn(),
  mockClearAllJwts: vi.fn(),
  mockClearZkLoginAddressCache: vi.fn(),
  mockZkProofClear: vi.fn(),
  mockDeviceLock: vi.fn(),
  mockGetCurrentTenantId: vi.fn(),
  mockSetCurrentTenantId: vi.fn(),
}));

vi.mock("#/auth/authConfig", () => ({
  getUserManager: vi.fn(() => ({
    removeUser: mockRemoveUser,
    signinRedirect: vi.fn(),
    getUser: vi.fn(),
    storeUser: vi.fn(),
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
  getCurrentTenantId: () => mockGetCurrentTenantId(),
  OAuthTenantSessionKey: "evevault_oauth_tenant",
  setCurrentTenantId: (...args: unknown[]) => mockSetCurrentTenantId(...args),
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
  performFullCleanup: (...args: unknown[]) => mockPerformFullCleanup(...args),
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

import {
  runTenantSwitchCleanup,
  switchTenantAndReload,
  useAuthStore,
} from "#/auth/stores/authStore";

describe("tenant switch auth cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRemoveUser.mockResolvedValue(undefined);
    mockPerformFullCleanup.mockResolvedValue(undefined);
    mockClearAllJwts.mockResolvedValue(undefined);
    mockZkProofClear.mockResolvedValue(undefined);
    mockDeviceLock.mockResolvedValue(undefined);
    mockGetCurrentTenantId.mockReturnValue("stillness");
    mockSetCurrentTenantId.mockResolvedValue(undefined);
    useAuthStore.setState({ user: { id_token: "token" } as never });
  });

  it("runTenantSwitchCleanup clears JWTs, removes OIDC user, and clears zkLogin address cache", async () => {
    await runTenantSwitchCleanup("stillness" as never);

    expect(mockRemoveUser).toHaveBeenCalledTimes(1);
    expect(mockPerformFullCleanup).toHaveBeenCalledTimes(1);
    expect(mockClearAllJwts).toHaveBeenCalledTimes(1);
    expect(mockClearZkLoginAddressCache).toHaveBeenCalledTimes(1);
    expect(mockZkProofClear).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("runTenantSwitchCleanup does not lock the vault", async () => {
    await runTenantSwitchCleanup("stillness" as never);

    expect(mockDeviceLock).not.toHaveBeenCalled();
  });

  it("switchTenantAndReload updates currentTenantId then reloads the page", async () => {
    const reload = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { reload },
    });

    await switchTenantAndReload("tauceti" as never);

    expect(mockSetCurrentTenantId).toHaveBeenCalledWith("tauceti");
    expect(reload).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("switchTenantAndReload is a no-op when the new tenant ID matches the current one", async () => {
    const reload = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { reload },
    });

    // mockGetCurrentTenantId returns "stillness" and we pass "stillness" — early return
    await switchTenantAndReload("stillness" as never);

    expect(mockSetCurrentTenantId).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();

    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("runTenantSwitchCleanup does not throw when a cleanup step rejects (error is caught internally)", async () => {
    mockClearAllJwts.mockRejectedValue(new Error("storage unavailable"));

    await expect(
      runTenantSwitchCleanup("stillness" as never),
    ).resolves.toBeUndefined();
  });
});
