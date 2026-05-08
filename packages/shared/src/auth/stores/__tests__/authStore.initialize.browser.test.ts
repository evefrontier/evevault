import { SUI_TESTNET_CHAIN } from "@mysten/wallet-standard";
import { User } from "oidc-client-ts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockStoreUser = vi.fn();
const mockSigninSilent = vi.fn();
const mockGetJwt = vi.fn();
const mockEnrichUser = vi.fn();
const mockSyncPrimaryJwt = vi.fn();
const mockUserToJwtResponse = vi.fn();
const mockResolveExpiresAt = vi.fn();
const mockIsExtension = vi.fn();
const mockDecodeJwt = vi.fn();

vi.mock("#/auth/authConfig", () => ({
  getUserManager: () => ({
    getUser: (...args: unknown[]) => mockGetUser(...args),
    storeUser: (...args: unknown[]) => mockStoreUser(...args),
    signinSilent: (...args: unknown[]) => mockSigninSilent(...args),
  }),
  redirectToFusionAuthLogout: vi.fn(),
}));

vi.mock("#/auth/storageService", () => ({
  getJwt: (...args: unknown[]) => mockGetJwt(...args),
  clearAllJwts: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("#/auth/userJwtSync", () => ({
  enrichUserWithZkLoginIfNeeded: (...args: unknown[]) =>
    mockEnrichUser(...args),
  syncPrimaryJwtFromUser: (...args: unknown[]) => mockSyncPrimaryJwt(...args),
}));

vi.mock("#/auth/userToJwtResponse", () => ({
  userToJwtResponse: (...args: unknown[]) => mockUserToJwtResponse(...args),
}));

vi.mock("#/auth/utils/authStoreUtils", () => ({
  resolveExpiresAt: (...args: unknown[]) => mockResolveExpiresAt(...args),
}));

vi.mock("#/utils/environment", () => ({
  isExtension: () => mockIsExtension(),
  isWeb: () => !mockIsExtension(),
  isBrowser: () => true,
}));

vi.mock("#/utils/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("#/utils/authCleanup", () => ({
  performFullCleanup: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("#/stores", () => ({
  useContextStore: {
    getState: vi.fn(() => ({ chain: SUI_TESTNET_CHAIN })),
  },
  useDeviceStore: {
    getState: vi.fn(() => ({
      networkData: {},
      lock: vi.fn().mockResolvedValue(undefined),
    })),
  },
}));

vi.mock("#/stores/tenantStore", () => ({
  getCurrentTenantId: vi.fn(() => "default"),
  OAuthTenantSessionKey: "evevault_oauth_tenant",
  setCurrentTenantId: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("#/services/vaultService", () => ({
  zkProofService: { clear: vi.fn().mockResolvedValue(undefined) },
  ephKeyService: { lock: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("#/utils/tenantConfig", () => ({
  getTenantConfig: vi.fn(() => ({
    serverUrl: "http://localhost",
    clientId: "test-client",
  })),
  DEFAULT_TENANT_ID: "default",
}));

vi.mock("#/auth/getZkLoginAddress", () => ({
  clearZkLoginAddressCache: vi.fn(),
  getZkLoginAddress: vi.fn(),
}));

vi.mock("#/auth/oauthTokenResponse", () => ({
  parseOAuthTokenResponse: vi.fn(),
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

// ─── import store after mocks ─────────────────────────────────────────────
import { useAuthStore } from "#/auth/stores/authStore";

// ─── helpers ──────────────────────────────────────────────────────────────

const FUTURE = Math.floor(Date.now() / 1000) + 3600;
const PAST = Math.floor(Date.now() / 1000) - 60;

function makeJwtPayload(claims: Record<string, unknown>): string {
  const payload = btoa(JSON.stringify(claims))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.sig`;
}

function makeStoredJwt(overrides: Record<string, unknown> = {}) {
  return {
    id_token: makeJwtPayload({ sub: "user-1", iat: 1000, exp: FUTURE }),
    access_token: "at",
    token_type: "Bearer",
    scope: "openid",
    refresh_token: "rt",
    expires_in: 3600,
    expires_at: FUTURE,
    ...overrides,
  };
}

function makeUser(
  overrides: Partial<ConstructorParameters<typeof User>[0]> = {},
) {
  return new User({
    id_token: makeJwtPayload({ sub: "user-1", iat: 1000, exp: FUTURE }),
    access_token: "at",
    token_type: "Bearer",
    scope: "openid",
    refresh_token: "rt",
    profile: { sub: "user-1" } as User["profile"],
    expires_at: FUTURE,
    ...overrides,
  });
}

describe("authStore.initialize() (extension path)", () => {
  let originalChrome: unknown;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsExtension.mockReturnValue(true);
    mockDecodeJwt.mockReturnValue({
      sub: "user-1",
      iat: 1000,
      exp: FUTURE,
      nonce: "test-nonce",
    });
    mockEnrichUser.mockImplementation(async (user: unknown) => user);
    mockStoreUser.mockResolvedValue(undefined);
    mockSyncPrimaryJwt.mockResolvedValue(undefined);
    useAuthStore.setState({ user: null, loading: false, error: null });

    originalChrome = (globalThis as unknown as { chrome: unknown }).chrome;
    (globalThis as unknown as { chrome: unknown }).chrome = {
      runtime: { id: "test-ext" },
      storage: { local: { get: vi.fn().mockResolvedValue({}) } },
    };
  });

  afterEach(() => {
    (globalThis as unknown as { chrome: unknown }).chrome = originalChrome;
  });

  describe("when UserManager has no user", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue(null);
    });

    it("sets user to null when there is no stored JWT", async () => {
      mockGetJwt.mockResolvedValue(null);

      await useAuthStore.getState().initialize();

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().loading).toBe(false);
      expect(mockStoreUser).not.toHaveBeenCalled();
      expect(mockSyncPrimaryJwt).not.toHaveBeenCalled();
    });

    it("rebuilds User from stored JWT and sets it", async () => {
      const storedJwt = makeStoredJwt();
      mockGetJwt.mockResolvedValue(storedJwt);
      // Return a valid non-expired snapshot so the expiry check passes
      mockUserToJwtResponse.mockReturnValue(storedJwt);
      mockResolveExpiresAt.mockReturnValue(FUTURE);

      await useAuthStore.getState().initialize();

      expect(mockStoreUser).toHaveBeenCalledOnce();
      expect(mockSyncPrimaryJwt).toHaveBeenCalledWith(expect.any(User));
      const { user } = useAuthStore.getState();
      expect(user).toBeInstanceOf(User);
      expect(user?.id_token).toBe(storedJwt.id_token);
      expect(useAuthStore.getState().loading).toBe(false);
    });

    it("sets user to null when stored JWT is expired and no refresh token", async () => {
      mockGetJwt.mockResolvedValue(
        makeStoredJwt({ refresh_token: "", expires_at: PAST }),
      );
      mockUserToJwtResponse.mockReturnValue(
        makeStoredJwt({ expires_at: PAST }),
      );
      mockResolveExpiresAt.mockReturnValue(PAST);

      await useAuthStore.getState().initialize();

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().loading).toBe(false);
      expect(mockSigninSilent).not.toHaveBeenCalled();
    });

    it("runs silent renew when stored JWT is expired but refresh token is present", async () => {
      const refreshedUser = makeUser({
        id_token: makeJwtPayload({ sub: "user-1", iat: 2000, exp: FUTURE }),
      });
      mockGetJwt.mockResolvedValue(makeStoredJwt({ expires_at: PAST }));
      mockUserToJwtResponse.mockReturnValue(
        makeStoredJwt({ expires_at: PAST }),
      );
      mockResolveExpiresAt
        .mockReturnValueOnce(PAST) // original user: expired
        .mockReturnValueOnce(FUTURE); // refreshed user: valid
      mockSigninSilent.mockResolvedValue(refreshedUser);
      mockEnrichUser.mockResolvedValue(refreshedUser);

      await useAuthStore.getState().initialize();

      expect(mockSigninSilent).toHaveBeenCalledOnce();
      // storeUser must have been called before signinSilent so the UserManager
      // had the refresh token available when signinSilent() ran.
      expect(mockStoreUser).toHaveBeenCalledBefore(mockSigninSilent);
      const seededUser = mockStoreUser.mock.calls[0][0] as User;
      expect(seededUser.refresh_token).toBe("rt");
      expect(useAuthStore.getState().user).toBe(refreshedUser);
      expect(useAuthStore.getState().loading).toBe(false);
    });

    it("calls storeUser with reconstructed user before signinSilent when JWT is expired and refresh token exists", async () => {
      const callOrder: string[] = [];
      const refreshedUser = makeUser({
        id_token: makeJwtPayload({ sub: "user-1", iat: 2000, exp: FUTURE }),
      });
      mockGetJwt.mockResolvedValue(makeStoredJwt({ expires_at: PAST }));
      mockUserToJwtResponse.mockReturnValue(
        makeStoredJwt({ expires_at: PAST }),
      );
      mockResolveExpiresAt
        .mockReturnValueOnce(PAST)
        .mockReturnValueOnce(FUTURE);
      mockStoreUser.mockImplementation(async (user: User) => {
        callOrder.push("storeUser");
        // First call must carry the refresh token so signinSilent can use it
        if (callOrder.filter((e) => e === "storeUser").length === 1) {
          expect(user.refresh_token).toBe("rt");
        }
      });
      mockSigninSilent.mockImplementation(async () => {
        callOrder.push("signinSilent");
        return refreshedUser;
      });
      mockEnrichUser.mockResolvedValue(refreshedUser);

      await useAuthStore.getState().initialize();

      // Full expected sequence: seed expired user → silent renew → persist refreshed user
      expect(callOrder).toEqual(["storeUser", "signinSilent", "storeUser"]);
      // First storeUser seeded the expired-but-refresh-token-bearing user
      expect(mockStoreUser.mock.calls[0][0]).toBeInstanceOf(User);
      expect((mockStoreUser.mock.calls[0][0] as User).refresh_token).toBe("rt");
      // Second storeUser persisted the refreshed user
      expect(mockStoreUser.mock.calls[1][0]).toBe(refreshedUser);
      expect(mockEnrichUser).toHaveBeenCalledWith(
        expect.any(User),
        expect.any(Function),
      );
    });

    it("sets user to null when silent renew fails", async () => {
      mockGetJwt.mockResolvedValue(makeStoredJwt({ expires_at: PAST }));
      mockUserToJwtResponse.mockReturnValue(
        makeStoredJwt({ expires_at: PAST }),
      );
      mockResolveExpiresAt.mockReturnValue(PAST);
      mockSigninSilent.mockRejectedValue(new Error("silent renew failed"));

      await useAuthStore.getState().initialize();

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().loading).toBe(false);
    });
  });

  describe("when UserManager already has a user", () => {
    it("uses the UserManager user directly without touching the stored JWT", async () => {
      const umUser = makeUser();
      mockGetUser.mockResolvedValue(umUser);
      mockGetJwt.mockResolvedValue(makeStoredJwt());
      mockUserToJwtResponse.mockReturnValue(makeStoredJwt());
      mockResolveExpiresAt.mockReturnValue(FUTURE);

      await useAuthStore.getState().initialize();

      expect(mockStoreUser).toHaveBeenCalledOnce();
      expect(useAuthStore.getState().user?.id_token).toBe(umUser.id_token);
      expect(useAuthStore.getState().loading).toBe(false);
      // The stored JWT path is never reached — the UserManager user is used directly
      expect(mockGetJwt).not.toHaveBeenCalled();
    });
  });

  describe("concurrent initialize() calls", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue(null);
    });

    it("both calls complete with loading: false and a non-null user", async () => {
      const storedJwt = makeStoredJwt();
      mockGetJwt.mockResolvedValue(storedJwt);
      mockUserToJwtResponse.mockReturnValue(storedJwt);
      mockResolveExpiresAt.mockReturnValue(FUTURE);

      await Promise.all([
        useAuthStore.getState().initialize(),
        useAuthStore.getState().initialize(),
      ]);

      expect(useAuthStore.getState().loading).toBe(false);
      expect(useAuthStore.getState().user).not.toBeNull();
      // There is no de-duplication guard: both calls run to completion independently.
      // If a guard is ever added, this count will drop to 1 and the test documents the intent.
      expect(mockStoreUser).toHaveBeenCalledTimes(2);
    });
  });
});
