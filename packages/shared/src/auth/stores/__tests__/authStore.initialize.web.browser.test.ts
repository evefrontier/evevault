import { User } from "oidc-client-ts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockStoreUser = vi.fn();
const mockSigninSilent = vi.fn();
const mockEnrichUser = vi.fn();
const mockSyncPrimaryJwt = vi.fn();
const mockUserToJwtResponse = vi.fn();
const mockResolveExpiresAt = vi.fn();
const mockIsExtension = vi.fn();

vi.mock("#/auth/authConfig", () => ({
  getUserManager: () => ({
    getUser: (...args: unknown[]) => mockGetUser(...args),
    storeUser: (...args: unknown[]) => mockStoreUser(...args),
    signinSilent: (...args: unknown[]) => mockSigninSilent(...args),
  }),
  redirectToFusionAuthLogout: vi.fn(),
}));

vi.mock("#/auth/storageService", () => ({
  getJwt: vi.fn().mockResolvedValue(null),
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
  isWeb: () => true,
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
    getState: vi.fn(() => ({ chain: "sui:testnet" })),
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
  decodeJwt: vi.fn(),
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

describe("authStore.initialize() (web path)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsExtension.mockReturnValue(false);
    mockEnrichUser.mockImplementation(async (user: unknown) => user);
    mockStoreUser.mockResolvedValue(undefined);
    mockSyncPrimaryJwt.mockResolvedValue(undefined);
    useAuthStore.setState({ user: null, loading: false, error: null });
  });

  it("sets user to webUser when the token is still valid", async () => {
    const user = makeUser();
    mockGetUser.mockResolvedValue(user);
    mockUserToJwtResponse.mockReturnValue(makeStoredJwt());
    mockResolveExpiresAt.mockReturnValue(FUTURE);

    await useAuthStore.getState().initialize();

    expect(useAuthStore.getState().user).toBe(user);
    expect(useAuthStore.getState().loading).toBe(false);
    expect(mockSigninSilent).not.toHaveBeenCalled();
  });

  describe("when the token is expired", () => {
    beforeEach(() => {
      mockUserToJwtResponse.mockReturnValue(
        makeStoredJwt({ expires_at: PAST }),
      );
      mockResolveExpiresAt.mockReturnValue(PAST);
    });

    it("sets user to null when there is no refresh token", async () => {
      mockGetUser.mockResolvedValue(makeUser({ refresh_token: "" }));

      await useAuthStore.getState().initialize();

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().loading).toBe(false);
      expect(mockSigninSilent).not.toHaveBeenCalled();
    });

    it("sets user to null when the refresh token is whitespace only", async () => {
      mockGetUser.mockResolvedValue(makeUser({ refresh_token: "   " }));

      await useAuthStore.getState().initialize();

      expect(useAuthStore.getState().user).toBeNull();
      expect(mockSigninSilent).not.toHaveBeenCalled();
    });

    it("runs silent renew and sets the refreshed user", async () => {
      const refreshed = makeUser({
        id_token: makeJwtPayload({ sub: "user-1", iat: 2000, exp: FUTURE }),
      });
      mockGetUser.mockResolvedValue(makeUser());
      mockSigninSilent.mockResolvedValue(refreshed);
      mockEnrichUser.mockResolvedValue(refreshed);

      await useAuthStore.getState().initialize();

      expect(mockSigninSilent).toHaveBeenCalledOnce();
      expect(mockEnrichUser).toHaveBeenCalledWith(
        expect.any(User),
        expect.any(Function),
      );
      expect(mockStoreUser).toHaveBeenCalledWith(refreshed);
      expect(mockSyncPrimaryJwt).toHaveBeenCalledWith(refreshed);
      expect(useAuthStore.getState().user).toBe(refreshed);
      expect(useAuthStore.getState().loading).toBe(false);
    });

    it("sets user to null when silent renew returns null", async () => {
      mockGetUser.mockResolvedValue(makeUser());
      mockSigninSilent.mockResolvedValue(null);

      await useAuthStore.getState().initialize();

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().loading).toBe(false);
      expect(mockStoreUser).not.toHaveBeenCalled();
    });

    it("sets user to null when silent renew throws", async () => {
      mockGetUser.mockResolvedValue(makeUser());
      mockSigninSilent.mockRejectedValue(new Error("network error"));

      await useAuthStore.getState().initialize();

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().loading).toBe(false);
    });
  });

  it("sets user to null when getUser returns null (no JWT to inspect)", async () => {
    mockGetUser.mockResolvedValue(null);
    mockUserToJwtResponse.mockReturnValue(null);

    await useAuthStore.getState().initialize();

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().loading).toBe(false);
    expect(mockSigninSilent).not.toHaveBeenCalled();
  });
});
