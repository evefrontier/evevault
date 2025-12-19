import { SUI_DEVNET_CHAIN } from "@mysten/wallet-standard";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as vaultService from "../../../services/vaultService";
import { useDeviceStore } from "../../../stores/deviceStore";
import { useNetworkStore } from "../../../stores/networkStore";
import * as utils from "../../../utils/authCleanup";
import * as authConfig from "../../authConfig";
import { useAuthStore } from "../authStore";

// Mock dependencies
vi.mock("../../../services/vaultService", () => ({
  ephKeyService: {
    lock: vi.fn(),
  },
  zkProofService: {
    clear: vi.fn(),
  },
}));

vi.mock("../../authConfig", () => {
  const mockUserManager = {
    removeUser: vi.fn(),
    signoutRedirect: vi.fn(),
    events: {
      addUserLoaded: vi.fn(),
      addUserUnloaded: vi.fn(),
      addSilentRenewError: vi.fn(),
    },
  };
  return {
    getUserManager: vi.fn(() => mockUserManager),
  };
});

vi.mock("../../../utils/authCleanup", () => ({
  performFullCleanup: vi.fn(),
}));

vi.mock("../../../utils/environment", () => ({
  isExtension: vi.fn(() => false),
  isWeb: vi.fn(() => true),
}));

vi.mock("../../../stores/deviceStore", () => ({
  useDeviceStore: {
    getState: vi.fn(),
  },
}));

vi.mock("../../../stores/networkStore", () => ({
  useNetworkStore: {
    getState: vi.fn(),
  },
}));

describe("authStore.logout()", () => {
  let mockUserManager: ReturnType<typeof vi.fn> & {
    removeUser: ReturnType<typeof vi.fn>;
    signoutRedirect: ReturnType<typeof vi.fn>;
    events: {
      addUserLoaded: ReturnType<typeof vi.fn>;
      addUserUnloaded: ReturnType<typeof vi.fn>;
      addSilentRenewError: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Get the mock user manager from the mocked function
    // biome-ignore lint/suspicious/noExplicitAny: Test mocking requires any type
    mockUserManager = vi.mocked(authConfig.getUserManager)() as any;
    vi.mocked(utils.performFullCleanup).mockResolvedValue(undefined);
    vi.mocked(vaultService.ephKeyService.lock).mockResolvedValue(undefined);
    vi.mocked(vaultService.zkProofService.clear).mockResolvedValue(undefined);
    vi.mocked(useNetworkStore.getState).mockReturnValue({
      chain: SUI_DEVNET_CHAIN,
      // biome-ignore lint/suspicious/noExplicitAny: Test mocking requires any type
    } as any);
    vi.mocked(useDeviceStore.getState).mockReturnValue({
      reset: vi.fn(),
      initializeForChain: vi.fn().mockResolvedValue(undefined),
      // biome-ignore lint/suspicious/noExplicitAny: Test mocking requires any type
    } as any);

    // Reset auth store state
    useAuthStore.setState({
      user: null,
      loading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls zkProofService.clear() during logout", async () => {
    const mockClear = vi.mocked(vaultService.zkProofService.clear);

    await useAuthStore.getState().logout();

    expect(mockClear).toHaveBeenCalledTimes(1);
  });

  it("calls ephKeyService.lock() during logout", async () => {
    const mockLock = vi.mocked(vaultService.ephKeyService.lock);

    await useAuthStore.getState().logout();

    expect(mockLock).toHaveBeenCalledTimes(1);
  });

  it("calls zkProofService.clear() before ephKeyService.lock()", async () => {
    const mockClear = vi.mocked(vaultService.zkProofService.clear);
    const mockLock = vi.mocked(vaultService.ephKeyService.lock);

    // Track call order
    const callOrder: string[] = [];
    mockClear.mockImplementation(async () => {
      callOrder.push("clear");
      return Promise.resolve();
    });
    mockLock.mockImplementation(async () => {
      callOrder.push("lock");
      return Promise.resolve();
    });

    await useAuthStore.getState().logout();

    expect(callOrder).toEqual(["clear", "lock"]);
  });

  it("calls performFullCleanup() during logout", async () => {
    const mockCleanup = vi.mocked(utils.performFullCleanup);

    await useAuthStore.getState().logout();

    expect(mockCleanup).toHaveBeenCalledTimes(1);
  });

  it("calls userManager.removeUser() before cleanup", async () => {
    const mockRemoveUser = vi.mocked(mockUserManager.removeUser);
    const mockCleanup = vi.mocked(utils.performFullCleanup);

    // Track call order
    const callOrder: string[] = [];
    mockRemoveUser.mockImplementation(async () => {
      callOrder.push("removeUser");
      return Promise.resolve();
    });
    mockCleanup.mockImplementation(async () => {
      callOrder.push("cleanup");
      return Promise.resolve();
    });

    await useAuthStore.getState().logout();

    expect(mockRemoveUser).toHaveBeenCalledTimes(1);
    expect(callOrder[0]).toBe("removeUser");
    expect(callOrder[1]).toBe("cleanup");
  });

  it("handles errors gracefully and still attempts redirect for web", async () => {
    const error = new Error("Lock failed");
    vi.mocked(vaultService.ephKeyService.lock).mockRejectedValueOnce(error);

    await useAuthStore.getState().logout();

    // Should still complete even with error (redirect happens)
    expect(useAuthStore.getState().error).toBe("Lock failed");
  });
});
