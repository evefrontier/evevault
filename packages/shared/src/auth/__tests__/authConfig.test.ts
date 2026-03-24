import { SUI_TESTNET_CHAIN } from "@mysten/wallet-standard";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refreshJwtMock = vi.fn();
const addAccessTokenExpiringMock = vi.fn();

vi.mock("oidc-client-ts", () => {
  class UserManager {
    events = {
      addUserLoaded: vi.fn(),
      addUserUnloaded: vi.fn(),
      addSilentRenewError: vi.fn(),
      addAccessTokenExpiring: addAccessTokenExpiringMock,
      addAccessTokenExpired: vi.fn(),
    };
  }

  class WebStorageStateStore {
    constructor(_args: unknown) {}
  }

  return {
    UserManager,
    WebStorageStateStore,
  };
});

vi.mock("../../stores/networkStore", () => ({
  useNetworkStore: {
    getState: () => ({ chain: SUI_TESTNET_CHAIN }),
  },
}));

vi.mock("../../utils/tenantConfig", () => ({
  getTenantConfig: () => ({
    clientId: "client-id",
    clientSecret: "secret",
    serverUrl: "https://issuer.example",
  }),
}));

vi.mock("../../utils/environment", () => ({
  isExtension: () => false,
}));

const authStoreMock = {
  useAuthStore: {
    getState: () => ({
      refreshJwt: refreshJwtMock,
      setUser: vi.fn(),
    }),
  },
};

vi.mock("../stores/authStore", () => authStoreMock);

describe("authConfig access token renewal", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("renews token on access token expiring event", async () => {
    const { getUserManager } = await import("../authConfig");
    getUserManager("stillness");

    expect(addAccessTokenExpiringMock).toHaveBeenCalledTimes(1);

    const handler = addAccessTokenExpiringMock.mock.calls[0]?.[0] as
      | (() => void)
      | undefined;
    expect(handler).toBeTypeOf("function");

    handler?.();
    await import("../stores/authStore");
    for (let i = 0; i < 20 && refreshJwtMock.mock.calls.length === 0; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    expect(refreshJwtMock).toHaveBeenCalledTimes(1);
    expect(refreshJwtMock).toHaveBeenCalledWith(SUI_TESTNET_CHAIN);
  });
});
