import { SUI_LOCALNET_CHAIN, SUI_TESTNET_CHAIN } from "@mysten/wallet-standard";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockSigninRedirect,
  mockInitializeForChain,
  mockIsExtension,
  mockGetCurrentTenantId,
} = vi.hoisted(() => ({
  mockSigninRedirect: vi.fn(),
  mockInitializeForChain: vi.fn(),
  mockIsExtension: vi.fn(),
  mockGetCurrentTenantId: vi.fn(),
}));

vi.mock("#/auth/authConfig", () => ({
  getUserManager: vi.fn(() => ({
    signinRedirect: mockSigninRedirect,
    getUser: vi.fn(),
    storeUser: vi.fn(),
    removeUser: vi.fn(),
    signinSilent: vi.fn(),
  })),
  redirectToFusionAuthLogout: vi.fn(),
}));

vi.mock("#/auth/storageService", () => ({
  clearAllJwts: vi.fn().mockResolvedValue(undefined),
  getJwt: vi.fn().mockResolvedValue(null),
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

vi.mock("#/auth/getZkLoginAddress", () => ({
  clearZkLoginAddressCache: vi.fn(),
}));

vi.mock("#/auth/oauthTokenResponse", () => ({
  parseOAuthTokenResponse: vi.fn(),
}));

vi.mock("#/services/vaultService", () => ({
  zkProofService: { clear: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("#/stores", () => ({
  useContextStore: {
    getState: vi.fn(() => ({ chain: SUI_TESTNET_CHAIN })),
  },
  useDeviceStore: {
    getState: vi.fn(() => ({
      networkData: {},
      initializeForChain: mockInitializeForChain,
      lock: vi.fn().mockResolvedValue(undefined),
    })),
  },
}));

vi.mock("#/stores/tenantStore", () => ({
  getCurrentTenantId: () => mockGetCurrentTenantId(),
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
  isExtension: () => mockIsExtension(),
  isWeb: () => !mockIsExtension(),
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

import { useAuthStore } from "#/auth/stores/authStore";
import { useContextStore } from "#/stores";

describe("authStore.login() web path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsExtension.mockReturnValue(false);
    mockGetCurrentTenantId.mockReturnValue("tauceti");
    mockInitializeForChain.mockResolvedValue(undefined);
    mockSigninRedirect.mockImplementation(() => undefined);
    vi.mocked(useContextStore.getState).mockReturnValue({
      chain: SUI_TESTNET_CHAIN,
    } as ReturnType<typeof useContextStore.getState>);
    sessionStorage.clear();
    useAuthStore.setState({ user: null, loading: false, error: null });
  });

  it("calls initializeForChain before signinRedirect on a zkLogin chain", async () => {
    const callOrder: string[] = [];
    mockInitializeForChain.mockImplementation(async () => {
      callOrder.push("initializeForChain");
    });
    mockSigninRedirect.mockImplementation(() => {
      callOrder.push("signinRedirect");
    });

    await useAuthStore.getState().login();

    expect(mockInitializeForChain).toHaveBeenCalledWith(SUI_TESTNET_CHAIN);
    expect(mockSigninRedirect).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(["initializeForChain", "signinRedirect"]);
  });

  it("stores tenantId in sessionStorage before redirecting", async () => {
    let tenantAtRedirect: string | null = null;
    mockSigninRedirect.mockImplementation(() => {
      tenantAtRedirect = sessionStorage.getItem("evevault_oauth_tenant");
    });

    await useAuthStore.getState().login();

    expect(tenantAtRedirect).toBe("tauceti");
  });

  it("does not call signinRedirect on non-zkLogin chains", async () => {
    // isZkLoginSuiChain returns true only for devnet, testnet, and mainnet.
    // SUI_LOCALNET_CHAIN ("sui:localnet") is explicitly excluded, so login skips
    // the OIDC redirect entirely. This tests the boundary: the first non-zkLogin chain.
    vi.mocked(useContextStore.getState).mockReturnValue({
      chain: SUI_LOCALNET_CHAIN,
    } as ReturnType<typeof useContextStore.getState>);

    await useAuthStore.getState().login();

    expect(mockInitializeForChain).not.toHaveBeenCalled();
    expect(mockSigninRedirect).not.toHaveBeenCalled();
  });

  it("sets loading to false after completion", async () => {
    await useAuthStore.getState().login();

    expect(useAuthStore.getState().loading).toBe(false);
  });

  it("two concurrent login() calls both resolve and leave loading: false", async () => {
    await Promise.all([
      useAuthStore.getState().login(),
      useAuthStore.getState().login(),
    ]);

    expect(useAuthStore.getState().loading).toBe(false);
  });

  it("sets loading to false when initializeForChain rejects with a network error", async () => {
    mockInitializeForChain.mockRejectedValue(new Error("Network error"));

    await useAuthStore.getState().login();

    expect(useAuthStore.getState().loading).toBe(false);
  });
});
