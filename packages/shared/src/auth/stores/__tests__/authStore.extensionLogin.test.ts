import { User } from "oidc-client-ts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthStoreMockHandles } from "./authStoreTestMocks";
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
  makeTokenResponse,
  makeUserJwtSyncMock,
  makeUserToJwtResponseMock,
  makeUtilsMock,
  makeVaultServiceMock,
  setupAuthStoreMocks,
} from "./authStoreTestMocks";

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
}));

vi.mock("#/auth/authConfig", () => makeAuthConfigMock(h));
vi.mock("#/auth/storageService", () => makeStorageServiceMock(h));
vi.mock("#/auth/userJwtSync", () => makeUserJwtSyncMock(h));
vi.mock("#/auth/userToJwtResponse", () => makeUserToJwtResponseMock(h));
vi.mock("#/auth/utils/authStoreUtils", () => makeAuthStoreUtilsMock(h));
vi.mock("#/auth/getZkLoginAddress", () => makeGetZkLoginAddressMock(h));
vi.mock("#/auth/oauthTokenResponse", () => makeOAuthTokenResponseMock(h));
vi.mock("#/services/vaultService", () => makeVaultServiceMock(h));
vi.mock("#/stores", () => makeStoresMock(h));
vi.mock("#/stores/tenantStore", () => makeTenantStoreMock(h));
vi.mock("#/utils", () => makeUtilsMock(h));
vi.mock("#/utils/tenantConfig", () => makeTenantConfigMock());
vi.mock("#/adapters", () => makeAdaptersMock());
vi.mock("jose", () => makeJoseMock(h));

import { useAuthStore } from "#/auth/stores/authStore";

type ChromeMessageListener = (message: {
  id: string;
  type: string;
  token?: unknown;
  error?: unknown;
}) => void;

describe("authStore.extensionLogin()", () => {
  const addListener = vi.fn();
  const removeListener = vi.fn();
  const sendMessage = vi.fn();

  beforeEach(() => {
    setupAuthStoreMocks(h, { isExtension: true });
    h.mockParseOAuthTokenResponse.mockReturnValue(makeTokenResponse());
    h.mockDecodeJwt.mockReturnValue({ sub: "user-1", iat: 1000, exp: 4600 });
    useAuthStore.setState({ user: null, loading: false, error: null });
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "uuid-1") });
    vi.stubGlobal("chrome", {
      runtime: {
        onMessage: { addListener, removeListener },
        sendMessage,
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
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
    h.mockParseOAuthTokenResponse.mockReturnValue(tokenResponse);
    const promise = useAuthStore.getState().extensionLogin();
    const listener = addListener.mock.calls[0][0] as ChromeMessageListener;

    listener({ id: "uuid-1", type: "auth_success", token: "raw-token" });

    await expect(promise).resolves.toBe(tokenResponse);
    expect(h.mockParseOAuthTokenResponse).toHaveBeenCalledWith("raw-token");
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
    h.mockParseOAuthTokenResponse.mockReturnValue(tokenResponse);
    const promise = useAuthStore.getState().extensionLogin();
    const listener = addListener.mock.calls[0][0] as ChromeMessageListener;

    listener({ id: "other-id", type: "auth_success", token: "wrong-token" });
    expect(h.mockParseOAuthTokenResponse).not.toHaveBeenCalled();

    listener({ id: "uuid-1", type: "auth_success", token: "right-token" });

    await expect(promise).resolves.toBe(tokenResponse);
    expect(h.mockParseOAuthTokenResponse).toHaveBeenCalledWith("right-token");
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
        } as unknown as User["profile"],
      });
      h.mockEnrichUser.mockResolvedValue(enrichedUser);

      const user = await useAuthStore.getState().login();

      expect(user).toBe(enrichedUser);
      expect(h.mockDecodeJwt).toHaveBeenCalledWith(tokenResponse.id_token);
      expect(h.mockEnrichUser).toHaveBeenCalledWith(
        expect.any(User),
        expect.any(Function),
      );
      // storeUser and syncPrimaryJwt must receive the enriched user, not the original
      expect(h.mockStoreUser).toHaveBeenCalledWith(enrichedUser);
      expect(h.mockSyncPrimaryJwt).toHaveBeenCalledWith(enrichedUser);
      expect(useAuthStore.getState().user).toBe(enrichedUser);
    });
  });
});
