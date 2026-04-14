import { SUI_DEVNET_CHAIN, SUI_TESTNET_CHAIN } from "@mysten/wallet-standard";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_STORAGE_KEY,
  JWT_STORAGE_KEY,
  NETWORK_STORAGE_KEY,
} from "../../utils/storageKeys";

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
  clearJwtForNetwork,
  clearZkLoginJwtForNetwork,
  getAllStoredJwts,
  getJwtForNetwork,
  getStoredChain,
  getStoredWalletAddress,
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

  it("storeJwt writes flat primary to localStorage", async () => {
    await storeJwt(baseJwt());
    const raw = localStorage.getItem(JWT_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string) as Record<string, unknown>;
    expect(parsed.primary).toMatchObject({ access_token: "at" });
  });

  it("storeJwt ignores chain param (primary is network-agnostic)", async () => {
    await storeJwt({ ...baseJwt(), access_token: "a1" }, SUI_TESTNET_CHAIN);
    await storeJwt({ ...baseJwt(), access_token: "a2" }, SUI_DEVNET_CHAIN);
    const raw = localStorage.getItem(JWT_STORAGE_KEY);
    const parsed = JSON.parse(raw as string) as {
      primary?: { access_token: string };
    };
    // Second write overwrites the single primary entry
    expect(parsed.primary?.access_token).toBe("a2");
  });

  it("getAllStoredJwts returns primary keyed by current chain", async () => {
    await storeJwt(baseJwt());
    const all = await getAllStoredJwts();
    expect(all?.[SUI_TESTNET_CHAIN]).toMatchObject({ access_token: "at" });
    expect(Object.keys(all ?? {}).length).toBe(1);
  });

  it("getJwtForNetwork uses OIDC user on web when chain matches", async () => {
    const jwt = baseJwt();
    vi.mocked(userToJwtResponse).mockReturnValue(jwt as never);
    const out = await getJwtForNetwork(SUI_TESTNET_CHAIN);
    expect(out).toEqual(jwt);
    expect(userToJwtResponse).toHaveBeenCalled();
  });

  it("getJwtForNetwork reads from storage for any chain (primary is shared)", async () => {
    await storeJwt(baseJwt());
    const out = await getJwtForNetwork(SUI_DEVNET_CHAIN);
    expect(out?.access_token).toBe("at");
  });

  it("getAllJwtEntries returns null for invalid JSON in localStorage", async () => {
    localStorage.setItem(JWT_STORAGE_KEY, "{not-json");
    await expect(getAllStoredJwts()).resolves.toBeNull();
  });

  it("clearJwtForNetwork only clears zkLogin for that chain, not primary", async () => {
    await storeJwt(baseJwt());
    await storeZkLoginJwtForNetwork(
      { id_token: "zk", expires_at: futureExp() },
      SUI_DEVNET_CHAIN,
    );
    await clearJwtForNetwork(SUI_DEVNET_CHAIN);
    const all = await getAllStoredJwts();
    // Primary should still exist
    expect(all?.[SUI_TESTNET_CHAIN]?.access_token).toBe("at");
    // zkLogin for devnet should be gone
    const raw = localStorage.getItem(JWT_STORAGE_KEY);
    const parsed = JSON.parse(raw as string) as {
      zkLogin?: Record<string, unknown>;
    };
    expect(parsed.zkLogin?.[SUI_DEVNET_CHAIN]).toBeUndefined();
  });

  it("clearAllJwts removes JWT key", async () => {
    await storeJwt(baseJwt());
    await clearAllJwts();
    expect(localStorage.getItem(JWT_STORAGE_KEY)).toBeNull();
  });

  it("hasJwt returns false when expired", async () => {
    await storeJwt({
      ...baseJwt(),
      expires_at: Math.floor(Date.now() / 1000) - 10,
    });
    await expect(hasJwt(SUI_TESTNET_CHAIN)).resolves.toBe(false);
  });

  it("hasJwt returns true when valid", async () => {
    await storeJwt(baseJwt());
    await expect(hasJwt(SUI_TESTNET_CHAIN)).resolves.toBe(true);
  });

  it("storeZkLoginJwtForNetwork merges with existing primary", async () => {
    await storeJwt(baseJwt());
    await storeZkLoginJwtForNetwork({
      id_token: "zk",
      expires_at: futureExp(),
    });
    const raw = localStorage.getItem(JWT_STORAGE_KEY);
    const parsed = JSON.parse(raw as string) as {
      primary?: unknown;
      zkLogin?: Record<string, unknown>;
    };
    expect(parsed.primary).toBeDefined();
    expect(parsed.zkLogin?.[SUI_TESTNET_CHAIN]).toMatchObject({
      id_token: "zk",
    });
  });

  it("clearZkLoginJwtForNetwork removes zkLogin but keeps primary", async () => {
    await storeJwt(baseJwt());
    await storeZkLoginJwtForNetwork({
      id_token: "zk",
      expires_at: futureExp(),
    });
    await clearZkLoginJwtForNetwork(SUI_TESTNET_CHAIN);
    const raw = localStorage.getItem(JWT_STORAGE_KEY);
    const parsed = JSON.parse(raw as string) as {
      primary?: unknown;
      zkLogin?: Record<string, unknown>;
    };
    expect(parsed.primary).toBeDefined();
    expect(parsed.zkLogin?.[SUI_TESTNET_CHAIN]).toBeUndefined();
  });

  it("clearZkLoginJwtForNetwork clears storage when only zkLogin existed", async () => {
    await storeZkLoginJwtForNetwork({
      id_token: "zk",
      expires_at: futureExp(),
    });
    await clearZkLoginJwtForNetwork(SUI_TESTNET_CHAIN);
    expect(localStorage.getItem(JWT_STORAGE_KEY)).toBeNull();
  });
});

describe("storageService (extension chrome.storage)", () => {
  const chromeStorage = {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(() => {
    vi.mocked(isExtension).mockReturnValue(true);
    vi.mocked(isWeb).mockReturnValue(false);
    chromeStorage.get.mockReset();
    chromeStorage.set.mockReset();
    chromeStorage.remove.mockReset();
    chromeStorage.get.mockResolvedValue({});
    chromeStorage.set.mockResolvedValue(undefined);
    chromeStorage.remove.mockResolvedValue(undefined);
    (globalThis as unknown as { chrome: typeof chrome }).chrome = {
      storage: { local: chromeStorage },
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

  it("storeJwt writes via chrome.storage.local.set", async () => {
    await storeJwt(baseJwt());
    expect(chromeStorage.set).toHaveBeenCalledWith(
      expect.objectContaining({
        [JWT_STORAGE_KEY]: expect.any(Object),
      }),
    );
  });

  it("clearAllJwts calls chrome.storage.local.remove", async () => {
    await clearAllJwts();
    expect(chromeStorage.remove).toHaveBeenCalledWith([JWT_STORAGE_KEY]);
  });
});

describe("getStoredWalletAddress / getStoredChain", () => {
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

  it("getStoredWalletAddress returns null when not extension", async () => {
    vi.mocked(isExtension).mockReturnValue(false);
    vi.mocked(isWeb).mockReturnValue(true);
    await expect(getStoredWalletAddress()).resolves.toBeNull();
  });

  it("getStoredWalletAddress returns sui_address from persisted auth", async () => {
    vi.mocked(isExtension).mockReturnValue(true);
    vi.mocked(isWeb).mockReturnValue(false);
    chromeStorage.get.mockResolvedValue({
      [AUTH_STORAGE_KEY]: JSON.stringify({
        state: { user: { profile: { sui_address: "0xabc" } } },
      }),
    });
    await expect(getStoredWalletAddress()).resolves.toBe("0xabc");
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
