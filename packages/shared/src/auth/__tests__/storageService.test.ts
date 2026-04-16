import { SUI_DEVNET_CHAIN, SUI_TESTNET_CHAIN } from "@mysten/wallet-standard";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JWT_STORAGE_KEY, NETWORK_STORAGE_KEY } from "../../utils/storageKeys";

vi.mock("../../utils/environment", () => ({
  isExtension: vi.fn(),
  isWeb: vi.fn(),
}));

vi.mock("../../utils/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("../../stores/networkStore", () => ({
  useNetworkStore: {
    getState: vi.fn(() => ({ chain: SUI_TESTNET_CHAIN })),
  },
}));

vi.mock("../stores/authStore", () => ({
  useAuthStore: {
    getState: vi.fn(() => ({ user: null })),
  },
}));

vi.mock("../userToJwtResponse", () => ({
  userToJwtResponse: vi.fn(),
}));

import { useNetworkStore } from "../../stores/networkStore";
import { isExtension, isWeb } from "../../utils/environment";
import {
  clearAllJwts,
  clearZkLoginJwtForNetwork,
  getJwt,
  getStoredChain,
  hasJwt,
  storeJwt,
  storeZkLoginJwtForNetwork,
} from "../storageService";
import { useAuthStore } from "../stores/authStore";
import { userToJwtResponse } from "../userToJwtResponse";

const futureExp = () => Math.floor(Date.now() / 1000) + 86_400;

const baseJwt = () => ({
  access_token: "at",
  id_token: "it",
  expires_in: 3600,
  scope: "openid",
  token_type: "Bearer",
  expires_at: futureExp(),
});

describe("storageService (web)", () => {
  beforeEach(() => {
    vi.mocked(isExtension).mockReturnValue(false);
    vi.mocked(isWeb).mockReturnValue(true);
    localStorage.clear();
    vi.mocked(useAuthStore.getState).mockReturnValue({ user: null } as never);
    vi.mocked(userToJwtResponse).mockReturnValue(null);
    vi.mocked(useNetworkStore.getState).mockReturnValue({
      chain: SUI_TESTNET_CHAIN,
    } as never);
  });

  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("storeJwt is a no-op on web (tokens managed by oidc-client-ts)", async () => {
    await storeJwt({ ...baseJwt(), refresh_token: "rt" });
    expect(localStorage.getItem(JWT_STORAGE_KEY)).toBeNull();
  });

  it("getJwt uses OIDC user on web", async () => {
    const jwt = baseJwt();
    vi.mocked(userToJwtResponse).mockReturnValue(jwt as never);
    const out = await getJwt();
    expect(out).toEqual(jwt);
    expect(userToJwtResponse).toHaveBeenCalled();
  });

  it("getJwt returns null when no OIDC user and no storage", async () => {
    const out = await getJwt();
    expect(out).toBeNull();
  });

  it("getJwt returns null for invalid JSON in localStorage", async () => {
    localStorage.setItem(JWT_STORAGE_KEY, "{not-json");
    await expect(getJwt()).resolves.toBeNull();
  });

  it("hasJwt returns false when no OIDC user", async () => {
    await expect(hasJwt()).resolves.toBe(false);
  });

  it("hasJwt returns false when OIDC user token is expired", async () => {
    vi.mocked(userToJwtResponse).mockReturnValue({
      ...baseJwt(),
      expires_at: Math.floor(Date.now() / 1000) - 10,
    } as never);
    await expect(hasJwt()).resolves.toBe(false);
  });

  it("hasJwt returns true when valid OIDC user is present", async () => {
    vi.mocked(userToJwtResponse).mockReturnValue(baseJwt() as never);
    await expect(hasJwt()).resolves.toBe(true);
  });

  it("storeZkLoginJwtForNetwork is a no-op on web", async () => {
    await storeZkLoginJwtForNetwork(
      { id_token: "zk", expires_at: futureExp() },
      SUI_DEVNET_CHAIN,
    );
    expect(localStorage.getItem(JWT_STORAGE_KEY)).toBeNull();
  });

  it("clearZkLoginJwtForNetwork is a no-op on web when storage is empty", async () => {
    await clearZkLoginJwtForNetwork(SUI_TESTNET_CHAIN);
    expect(localStorage.getItem(JWT_STORAGE_KEY)).toBeNull();
  });
});

describe("storageService (extension chrome.storage.session)", () => {
  const chromeStorageSession = {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(() => {
    vi.mocked(isExtension).mockReturnValue(true);
    vi.mocked(isWeb).mockReturnValue(false);
    chromeStorageSession.get.mockReset();
    chromeStorageSession.set.mockReset();
    chromeStorageSession.remove.mockReset();
    chromeStorageSession.get.mockResolvedValue({});
    chromeStorageSession.set.mockResolvedValue(undefined);
    chromeStorageSession.remove.mockResolvedValue(undefined);
    (globalThis as unknown as { chrome: typeof chrome }).chrome = {
      storage: { session: chromeStorageSession },
      runtime: { id: "test-extension" },
    } as unknown as typeof chrome;
    vi.mocked(useNetworkStore.getState).mockReturnValue({
      chain: SUI_TESTNET_CHAIN,
    } as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
  });

  it("storeJwt writes via chrome.storage.session.set", async () => {
    await storeJwt({ ...baseJwt(), refresh_token: "rt" });
    expect(chromeStorageSession.set).toHaveBeenCalledWith(
      expect.objectContaining({
        [JWT_STORAGE_KEY]: expect.any(Object),
      }),
    );
  });

  it("clearAllJwts calls chrome.storage.session.remove", async () => {
    await clearAllJwts();
    expect(chromeStorageSession.remove).toHaveBeenCalledWith([JWT_STORAGE_KEY]);
  });
});

describe("getStoredChain", () => {
  const chromeStorage = {
    get: vi.fn(),
  };

  beforeEach(() => {
    chromeStorage.get.mockReset();
    chromeStorage.get.mockResolvedValue({});
    (globalThis as unknown as { chrome: typeof chrome }).chrome = {
      storage: { local: chromeStorage },
      runtime: { id: "ext" },
    } as unknown as typeof chrome;
  });

  afterEach(() => {
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
    vi.clearAllMocks();
  });

  it("getStoredChain returns default when not extension", async () => {
    vi.mocked(isExtension).mockReturnValue(false);
    vi.mocked(isWeb).mockReturnValue(true);
    await expect(getStoredChain()).resolves.toBe(SUI_TESTNET_CHAIN);
  });

  it("getStoredChain reads chain from persisted network store", async () => {
    vi.mocked(isExtension).mockReturnValue(true);
    vi.mocked(isWeb).mockReturnValue(false);
    chromeStorage.get.mockResolvedValue({
      [NETWORK_STORAGE_KEY]: JSON.stringify({
        state: { chain: SUI_DEVNET_CHAIN },
      }),
    });
    await expect(getStoredChain()).resolves.toBe(SUI_DEVNET_CHAIN);
  });
});
