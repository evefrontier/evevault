import { SUI_LOCALNET_CHAIN, SUI_TESTNET_CHAIN } from "@mysten/wallet-standard";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
import { useContextStore } from "#/stores";

describe("authStore.login() web path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuthStoreMocks(h, { tenantId: "tauceti" });
    h.mockSigninRedirect.mockImplementation(() => undefined);
    vi.mocked(useContextStore.getState).mockReturnValue({
      chain: SUI_TESTNET_CHAIN,
    } as ReturnType<typeof useContextStore.getState>);
    sessionStorage.clear();
    useAuthStore.setState({ user: null, loading: false, error: null });
  });

  it("calls initializeForChain before signinRedirect on a zkLogin chain", async () => {
    const callOrder: string[] = [];
    h.mockInitializeForChain.mockImplementation(async () => {
      callOrder.push("initializeForChain");
    });
    h.mockSigninRedirect.mockImplementation(() => {
      callOrder.push("signinRedirect");
    });

    await useAuthStore.getState().login();

    expect(h.mockInitializeForChain).toHaveBeenCalledWith(SUI_TESTNET_CHAIN);
    expect(h.mockSigninRedirect).toHaveBeenCalledOnce();
    expect(callOrder).toEqual(["initializeForChain", "signinRedirect"]);
  });

  it("stores tenantId in sessionStorage before redirecting", async () => {
    let tenantAtRedirect: string | null = null;
    h.mockSigninRedirect.mockImplementation(() => {
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

    expect(h.mockInitializeForChain).not.toHaveBeenCalled();
    expect(h.mockSigninRedirect).not.toHaveBeenCalled();
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
    h.mockInitializeForChain.mockRejectedValue(new Error("Network error"));

    await useAuthStore.getState().login();

    expect(useAuthStore.getState().loading).toBe(false);
  });
});
