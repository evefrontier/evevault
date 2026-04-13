import { beforeEach, describe, expect, it, vi } from "vitest";

const { oidcMocks, logMocks } = vi.hoisted(() => {
  const userManagerConstructor = vi.fn();
  const addSilentRenewError = vi.fn();
  const logError = vi.fn();

  return {
    oidcMocks: { userManagerConstructor, addSilentRenewError },
    logMocks: { logError },
  };
});

vi.mock("../../utils/logger", () => ({
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

describe("authConfig UserManager", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("passes automaticSilentRenew to UserManager", async () => {
    const { getUserManager } = await import("../authConfig");
    getUserManager("stillness");

    expect(oidcMocks.userManagerConstructor).toHaveBeenCalledTimes(1);
    const settings = oidcMocks.userManagerConstructor.mock.calls[0]?.[0] as {
      automaticSilentRenew?: boolean;
    };

    expect(settings.automaticSilentRenew).toBe(true);
  });

  it("logs when silent renew handler is invoked with an error", async () => {
    const { getUserManager } = await import("../authConfig");
    getUserManager("stillness");

    expect(oidcMocks.addSilentRenewError).toHaveBeenCalledTimes(1);
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
