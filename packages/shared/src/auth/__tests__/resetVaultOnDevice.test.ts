import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as vaultService from "../../services/vaultService";
import { useDeviceStore } from "../../stores/deviceStore";
import { useNetworkStore } from "../../stores/networkStore";
import { useTokenListStore } from "../../stores/tokenListStore";
import * as authCleanup from "../../utils/authCleanup";
import * as env from "../../utils/environment";
import * as authConfig from "../authConfig";
import * as getZkLoginAddress from "../getZkLoginAddress";
import { resetVaultOnDevice } from "../resetVaultOnDevice";
import * as storageService from "../storageService";
import { useAuthStore } from "../stores/authStore";

vi.mock("../../services/vaultService", () => ({
  ephKeyService: { clear: vi.fn() },
  zkProofService: { clear: vi.fn() },
}));

vi.mock("../../utils/environment", () => ({
  isExtension: vi.fn(),
  isWeb: vi.fn(),
}));

vi.mock("../../utils/authCleanup", () => ({
  cleanupOidcStorage: vi.fn(),
  cleanupExtensionStorage: vi.fn(),
}));

vi.mock("../authConfig", () => ({
  getUserManager: vi.fn(() => ({
    removeUser: vi.fn(),
  })),
}));

vi.mock("../getZkLoginAddress", () => ({
  clearZkLoginAddressCache: vi.fn(),
}));

vi.mock("../storageService", () => ({
  clearAllJwts: vi.fn(),
}));

vi.mock("../../stores/deviceStore", () => ({
  useDeviceStore: {
    getState: vi.fn(),
  },
}));

vi.mock("../../stores/networkStore", () => ({
  useNetworkStore: {
    setState: vi.fn(),
  },
}));

vi.mock("../../stores/tokenListStore", () => ({
  useTokenListStore: {
    setState: vi.fn(),
  },
}));

vi.mock("../stores/authStore", () => ({
  useAuthStore: {
    setState: vi.fn(),
  },
}));

vi.mock("../../utils/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe("resetVaultOnDevice", () => {
  let mockRemoveUser: ReturnType<typeof vi.fn>;
  let mockDeviceLock: ReturnType<typeof vi.fn>;
  let mockDeviceReset: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRemoveUser = vi.fn().mockResolvedValue(undefined);
    vi.mocked(authConfig.getUserManager).mockReturnValue({
      removeUser: mockRemoveUser,
    } as unknown as ReturnType<typeof authConfig.getUserManager>);

    mockDeviceLock = vi.fn().mockResolvedValue(undefined);
    mockDeviceReset = vi.fn();
    vi.mocked(useDeviceStore.getState).mockReturnValue({
      lock: mockDeviceLock,
      reset: mockDeviceReset,
    } as unknown as ReturnType<typeof useDeviceStore.getState>);

    vi.mocked(vaultService.zkProofService.clear).mockResolvedValue(undefined);
    vi.mocked(vaultService.ephKeyService.clear).mockResolvedValue(undefined);
    vi.mocked(storageService.clearAllJwts).mockResolvedValue(undefined);
    vi.mocked(authCleanup.cleanupOidcStorage).mockImplementation(() => {});
    vi.mocked(authCleanup.cleanupExtensionStorage).mockResolvedValue(undefined);
    vi.mocked(getZkLoginAddress.clearZkLoginAddressCache).mockImplementation(
      () => {},
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls zkProofService.clear() and ephKeyService.clear()", async () => {
    vi.mocked(env.isWeb).mockReturnValue(true);
    vi.mocked(env.isExtension).mockReturnValue(false);

    await resetVaultOnDevice();

    expect(vaultService.zkProofService.clear).toHaveBeenCalledTimes(1);
    expect(vaultService.ephKeyService.clear).toHaveBeenCalledTimes(1);
  });

  it("calls deviceStore.lock() only when isExtension()", async () => {
    vi.mocked(env.isWeb).mockReturnValue(false);
    vi.mocked(env.isExtension).mockReturnValue(true);

    await resetVaultOnDevice();

    expect(mockDeviceLock).toHaveBeenCalledTimes(1);
  });

  it("does not call deviceStore.lock() when isWeb()", async () => {
    vi.mocked(env.isWeb).mockReturnValue(true);
    vi.mocked(env.isExtension).mockReturnValue(false);

    await resetVaultOnDevice();

    expect(mockDeviceLock).not.toHaveBeenCalled();
  });

  it("calls clearAllJwts() and userManager.removeUser()", async () => {
    vi.mocked(env.isWeb).mockReturnValue(true);
    vi.mocked(env.isExtension).mockReturnValue(false);

    await resetVaultOnDevice();

    expect(storageService.clearAllJwts).toHaveBeenCalledTimes(1);
    expect(mockRemoveUser).toHaveBeenCalledTimes(1);
  });

  it("calls deviceStore.reset() and clears in-memory stores", async () => {
    vi.mocked(env.isWeb).mockReturnValue(true);
    vi.mocked(env.isExtension).mockReturnValue(false);

    await resetVaultOnDevice();

    expect(mockDeviceReset).toHaveBeenCalledTimes(1);
    expect(useAuthStore.setState).toHaveBeenCalledWith({
      user: null,
      loading: false,
      error: null,
    });
    expect(useNetworkStore.setState).toHaveBeenCalledWith({
      chain: expect.any(String),
      loading: false,
    });
    expect(useTokenListStore.setState).toHaveBeenCalled();
  });

  it("calls clearZkLoginAddressCache()", async () => {
    vi.mocked(env.isWeb).mockReturnValue(true);
    vi.mocked(env.isExtension).mockReturnValue(false);

    await resetVaultOnDevice();

    expect(getZkLoginAddress.clearZkLoginAddressCache).toHaveBeenCalledTimes(1);
  });

  it("calls cleanupOidcStorage when isWeb()", async () => {
    vi.mocked(env.isWeb).mockReturnValue(true);
    vi.mocked(env.isExtension).mockReturnValue(false);

    const removeItem = vi.fn();
    const sessionRemoveItem = vi.fn();
    Object.defineProperty(global, "window", {
      value: {
        localStorage: { removeItem },
        sessionStorage: { removeItem: sessionRemoveItem },
      },
      writable: true,
    });

    await resetVaultOnDevice();

    expect(authCleanup.cleanupOidcStorage).toHaveBeenCalledTimes(1);
  });

  it("calls cleanupExtensionStorage when isExtension()", async () => {
    vi.mocked(env.isWeb).mockReturnValue(false);
    vi.mocked(env.isExtension).mockReturnValue(true);
    const remove = vi
      .fn()
      .mockImplementation((_keys: string[], cb: () => void) => cb());
    (
      global as unknown as {
        chrome: { storage: { local: { remove: typeof remove } } };
      }
    ).chrome = {
      storage: { local: { remove } },
    };

    await resetVaultOnDevice();

    expect(authCleanup.cleanupExtensionStorage).toHaveBeenCalledTimes(1);
  });

  it("propagates error when clearAllJwts fails", async () => {
    vi.mocked(env.isWeb).mockReturnValue(true);
    vi.mocked(env.isExtension).mockReturnValue(false);
    vi.mocked(storageService.clearAllJwts).mockRejectedValueOnce(
      new Error("JWT clear failed"),
    );

    await expect(resetVaultOnDevice()).rejects.toThrow("JWT clear failed");
  });

  it("propagates error when userManager.removeUser fails", async () => {
    vi.mocked(env.isWeb).mockReturnValue(true);
    vi.mocked(env.isExtension).mockReturnValue(false);
    mockRemoveUser.mockRejectedValueOnce(new Error("Remove user failed"));

    await expect(resetVaultOnDevice()).rejects.toThrow("Remove user failed");
  });
});
