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

import {
  runTenantSwitchCleanup,
  switchTenantAndReload,
  useAuthStore,
} from "#/auth/stores/authStore";

describe("tenant switch auth cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuthStoreMocks(h);
    useAuthStore.setState({ user: { id_token: "token" } as never });
  });

  it("runTenantSwitchCleanup clears JWTs, removes OIDC user, and clears zkLogin address cache", async () => {
    await runTenantSwitchCleanup("stillness" as never);
    expect(h.mockRemoveUser).toHaveBeenCalledOnce;
    expect(h.mockPerformFullCleanup).toHaveBeenCalledOnce;
    expect(h.mockClearAllJwts).toHaveBeenCalledOnce;
    expect(h.mockClearZkLoginAddressCache).toHaveBeenCalledOnce;
    expect(h.mockZkProofClear).toHaveBeenCalledOnce;
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("runTenantSwitchCleanup does not lock the vault", async () => {
    await runTenantSwitchCleanup("stillness" as never);

    expect(h.mockDeviceLock).not.toHaveBeenCalled();
  });

  it("switchTenantAndReload updates currentTenantId then reloads the page", async () => {
    const reload = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { reload },
    });

    try {
      await switchTenantAndReload("tauceti" as never);

      expect(h.mockSetCurrentTenantId).toHaveBeenCalledWith("tauceti");
      expect(reload).toHaveBeenCalledOnce();
      expect(window.location.href).toBe("http://localhost:3001?tenant=tauceti");
    } finally {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: originalLocation,
      });
    }
  });

  it("switchTenantAndReload is a no-op when the new tenant ID matches the current one", async () => {
    const reload = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { reload },
    });

    try {
      // mockGetCurrentTenantId returns "stillness" and we pass "stillness" — early return
      await switchTenantAndReload("stillness" as never);

      expect(h.mockSetCurrentTenantId).not.toHaveBeenCalled();
      expect(reload).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: originalLocation,
      });
    }
  });

  it("runTenantSwitchCleanup does not throw when a cleanup step rejects (error is caught internally)", async () => {
    h.mockClearAllJwts.mockRejectedValue(new Error("storage unavailable"));

    await expect(
      runTenantSwitchCleanup("stillness" as never),
    ).resolves.toBeUndefined();
  });
});
