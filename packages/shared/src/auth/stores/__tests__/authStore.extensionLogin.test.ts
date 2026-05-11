import { SUI_TESTNET_CHAIN } from "@mysten/wallet-standard";
import { User } from "oidc-client-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockStoreUser,
  mockDecodeJwt,
  mockEnrichUser,
  mockSyncPrimaryJwtFromUser,
  mockParseOAuthTokenResponse,
  mockIsExtension,
} = vi.hoisted(() => ({
  mockStoreUser: vi.fn(),
  mockDecodeJwt: vi.fn(),
  mockEnrichUser: vi.fn(),
  mockSyncPrimaryJwtFromUser: vi.fn(),
  mockParseOAuthTokenResponse: vi.fn(),
  mockIsExtension: vi.fn(),
}));

vi.mock("#/auth/authConfig", () => ({
  getUserManager: vi.fn(() => ({
    getUser: vi.fn(),
    storeUser: mockStoreUser,
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

vi.mock("#/auth/userJwtSync", () => ({
  enrichUserWithZkLoginIfNeeded: (...args: unknown[]) =>
    mockEnrichUser(...args),
  syncPrimaryJwtFromUser: (...args: unknown[]) =>
    mockSyncPrimaryJwtFromUser(...args),
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
  parseOAuthTokenResponse: (...args: unknown[]) =>
    mockParseOAuthTokenResponse(...args),
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
  decodeJwt: (...args: unknown[]) => mockDecodeJwt(...args),
}));

import { useAuthStore } from "#/auth/stores/authStore";

type ChromeMessageListener = (message: {
  id: string;
  type: string;
  token?: unknown;
  error?: unknown;
}) => void;

function makeJwtPayload(claims: Record<string, unknown>): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.sig`;
}

function makeTokenResponse() {
  return {
    id_token: makeJwtPayload({ sub: "user-1", iat: 1000, exp: 4600 }),
    access_token: "access-token",
    token_type: "Bearer",
    scope: "openid",
    refresh_token: "refresh-token",
    expires_in: 3600,
  };
}

describe("authStore.extensionLogin()", () => {
  const addListener = vi.fn();
  const removeListener = vi.fn();
  const sendMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsExtension.mockReturnValue(true);
    mockParseOAuthTokenResponse.mockReturnValue(makeTokenResponse());
    mockDecodeJwt.mockReturnValue({ sub: "user-1", iat: 1000, exp: 4600 });
    mockEnrichUser.mockImplementation(async (user: User) => user);
    mockStoreUser.mockResolvedValue(undefined);
    mockSyncPrimaryJwtFromUser.mockResolvedValue(undefined);
    useAuthStore.setState({ user: null, loading: false, error: null });
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "uuid-1") });
    vi.stubGlobal("chrome", {
      runtime: {
        onMessage: { addListener, removeListener },
        sendMessage,
      },
    });
  });

  it("sets up a chrome.runtime.onMessage listener with a unique UUID", () => {
    void useAuthStore.getState().extensionLogin();

    expect(addListener).toHaveBeenCalledWith(expect.any(Function));
    expect(sendMessage).toHaveBeenCalledWith({
      action: "ext_login",
      id: "uuid-1",
      tenantId: "stillness",
    });
  });

  it("resolves when the response message carries matching messageId and auth_success", async () => {
    const tokenResponse = makeTokenResponse();
    mockParseOAuthTokenResponse.mockReturnValue(tokenResponse);
    const promise = useAuthStore.getState().extensionLogin();
    const listener = addListener.mock.calls[0][0] as ChromeMessageListener;

    listener({ id: "uuid-1", type: "auth_success", token: "raw-token" });

    await expect(promise).resolves.toBe(tokenResponse);
    expect(mockParseOAuthTokenResponse).toHaveBeenCalledWith("raw-token");
    expect(removeListener).toHaveBeenCalledWith(listener);
  });

  it("rejects on auth_error", async () => {
    const promise = useAuthStore.getState().extensionLogin();
    const listener = addListener.mock.calls[0][0] as ChromeMessageListener;

    listener({
      id: "uuid-1",
      type: "auth_error",
      error: new Error("denied"),
    });

    await expect(promise).rejects.toThrow("denied");
    expect(removeListener).toHaveBeenCalledWith(listener);
  });

  it("ignores messages with a non-matching messageId", async () => {
    const tokenResponse = makeTokenResponse();
    mockParseOAuthTokenResponse.mockReturnValue(tokenResponse);
    const promise = useAuthStore.getState().extensionLogin();
    const listener = addListener.mock.calls[0][0] as ChromeMessageListener;

    listener({ id: "other-id", type: "auth_success", token: "wrong-token" });
    expect(mockParseOAuthTokenResponse).not.toHaveBeenCalled();

    listener({ id: "uuid-1", type: "auth_success", token: "right-token" });

    await expect(promise).resolves.toBe(tokenResponse);
    expect(mockParseOAuthTokenResponse).toHaveBeenCalledWith("right-token");
  });

  describe("login() wrapping extensionLogin()", () => {
    it("silently swallows user-did-not-approve errors during login", async () => {
      useAuthStore.setState({
        extensionLogin: vi
          .fn()
          .mockRejectedValue(new Error("The user did not approve access.")),
      });

      await useAuthStore.getState().login();

      expect(useAuthStore.getState().error).toBeNull();
      expect(useAuthStore.getState().loading).toBe(false);
    });

    it("creates a User from the parsed JWT, enriches it, and syncs the primary JWT", async () => {
      const tokenResponse = makeTokenResponse();
      useAuthStore.setState({
        extensionLogin: vi.fn().mockResolvedValue(tokenResponse),
      });

      // Return a distinctly different enriched user so we can verify the store
      // holds the *result* of enrichment, not the pre-enrichment user.
      const enrichedUser = new User({
        id_token: tokenResponse.id_token,
        access_token: "enriched-access-token",
        token_type: "Bearer",
        scope: "openid",
        profile: {
          sub: "user-1",
          zkLoginAddress: "0xenriched",
        } as User["profile"],
      });
      mockEnrichUser.mockResolvedValue(enrichedUser);

      const user = await useAuthStore.getState().login();

      expect(user).toBe(enrichedUser);
      expect(mockDecodeJwt).toHaveBeenCalledWith(tokenResponse.id_token);
      expect(mockEnrichUser).toHaveBeenCalledWith(
        expect.any(User),
        expect.any(Function),
      );
      // storeUser and syncPrimaryJwt must receive the enriched user, not the original
      expect(mockStoreUser).toHaveBeenCalledWith(enrichedUser);
      expect(mockSyncPrimaryJwtFromUser).toHaveBeenCalledWith(enrichedUser);
      expect(useAuthStore.getState().user).toBe(enrichedUser);
    });
  });
});
