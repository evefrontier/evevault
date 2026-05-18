import { TenantId } from "@evefrontier/dapp-kit";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { oidcMocks, logMocks, envMocks } = vi.hoisted(() => {
  const userManagerConstructor = vi.fn();
  const addSilentRenewError = vi.fn();
  const logError = vi.fn();
  const isExtension = vi.fn(() => false);
  const isWeb = vi.fn(() => false);

  return {
    oidcMocks: { userManagerConstructor, addSilentRenewError },
    logMocks: { logError },
    envMocks: { isExtension, isWeb },
  };
});

vi.mock("#/utils/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: logMocks.logError,
  }),
}));

vi.mock("oidc-client-ts", () => {
  class UserManager {
    constructor(settings: unknown) {
      oidcMocks.userManagerConstructor(settings);
    }
    events = {
      addUserLoaded: vi.fn(),
      addUserUnloaded: vi.fn(),
      addSilentRenewError: oidcMocks.addSilentRenewError,
      addAccessTokenExpired: vi.fn(),
    };
  }

  class WebStorageStateStore {}

  return {
    UserManager,
    WebStorageStateStore,
  };
});

vi.mock("#/utils/tenantConfig", () => ({
  getTenantConfig: () => ({
    clientId: "client-id",
    clientSecret: "secret",
    serverUrl: "https://issuer.example",
  }),
}));

vi.mock("#/utils/environment", () => ({
  isExtension: () => envMocks.isExtension(),
  isWeb: () => envMocks.isWeb(),
}));

describe("authConfig UserManager", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    envMocks.isExtension.mockReturnValue(false);
    envMocks.isWeb.mockReturnValue(false);
  });

  it("passes automaticSilentRenew to UserManager", async () => {
    const { getUserManager } = await import("#/auth/authConfig");
    getUserManager(TenantId.STILLNESS);

    expect(oidcMocks.userManagerConstructor).toHaveBeenCalledOnce;
    const settings = oidcMocks.userManagerConstructor.mock.calls[0]?.[0] as {
      automaticSilentRenew?: boolean;
    };

    expect(settings.automaticSilentRenew).toBe(true);
  });

  it("sets automaticSilentRenew to false in extension environment", async () => {
    envMocks.isExtension.mockReturnValue(true);
    (globalThis as unknown as { chrome: unknown }).chrome = {
      runtime: { id: "test-ext" },
    };
    try {
      const { getUserManager } = await import("#/auth/authConfig");
      getUserManager(TenantId.STILLNESS);

      const settings = oidcMocks.userManagerConstructor.mock.calls[0]?.[0] as {
        automaticSilentRenew?: boolean;
      };
      expect(settings.automaticSilentRenew).toBe(false);
    } finally {
      delete (globalThis as unknown as { chrome?: unknown }).chrome;
    }
  });

  it("logs when silent renew handler is invoked with an error", async () => {
    const { getUserManager } = await import("#/auth/authConfig");
    getUserManager(TenantId.STILLNESS);

    expect(oidcMocks.addSilentRenewError).toHaveBeenCalledOnce;
    const handler = oidcMocks.addSilentRenewError.mock.calls[0]?.[0] as
      | ((error: unknown) => void)
      | undefined;
    expect(handler).toBeTypeOf("function");

    const fakeError = new Error("silent renew failed");
    handler?.(fakeError);

    expect(logMocks.logError).toHaveBeenCalledWith(
      "OIDC silent renew error",
      expect.objectContaining({
        tenantId: "stillness",
        error: fakeError,
      }),
    );
  });
});
