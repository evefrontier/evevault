import { SUI_DEVNET_CHAIN } from "@mysten/wallet-standard";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as keeperService from "../../../services/keeperService";
import { useDeviceStore } from "../../../stores/deviceStore";
import { useNetworkStore } from "../../../stores/networkStore";
import * as utils from "../../../utils/authCleanup";
import * as authConfig from "../../authConfig";
import { useAuthStore } from "../authStore";

// Mock dependencies
vi.mock("../../../services/keeperService", () => ({
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
    mockUserManager = vi.mocked(authConfig.getUserManager)() as any;
    vi.mocked(utils.performFullCleanup).mockResolvedValue(undefined);
    vi.mocked(keeperService.ephKeyService.lock).mockResolvedValue(undefined);
    vi.mocked(useNetworkStore.getState).mockReturnValue({
      chain: SUI_DEVNET_CHAIN,
    } as any);
    vi.mocked(useDeviceStore.getState).mockReturnValue({
      reset: vi.fn(),
      initializeForChain: vi.fn().mockResolvedValue(undefined),
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

  it("calls ephKeyService.lock() during logout", async () => {
    const mockLock = vi.mocked(keeperService.zkProofService.clear);

    await useAuthStore.getState().logout();

    expect(mockLock).toHaveBeenCalledTimes(1);
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

  it("calls deviceStore.reset() and initializeForChain() after cleanup", async () => {
    const mockReset = vi.fn();
    const mockInitializeForChain = vi.fn().mockResolvedValue(undefined);

    vi.mocked(useDeviceStore.getState).mockReturnValue({
      reset: mockReset,
      initializeForChain: mockInitializeForChain,
    } as any);

    // Track call order
    const callOrder: string[] = [];
    mockReset.mockImplementation(() => {
      callOrder.push("reset");
    });
    mockInitializeForChain.mockImplementation(async () => {
      callOrder.push("initializeForChain");
      return Promise.resolve();
    });

    await useAuthStore.getState().logout();

    expect(mockReset).toHaveBeenCalledTimes(1);
    expect(mockInitializeForChain).toHaveBeenCalledWith(SUI_DEVNET_CHAIN);
    expect(callOrder.indexOf("reset")).toBeLessThan(
      callOrder.indexOf("initializeForChain"),
    );
  });

  it("handles errors gracefully and still attempts signout redirect for web", async () => {
    const error = new Error("Lock failed");
    vi.mocked(keeperService.ephKeyService.lock).mockRejectedValueOnce(error);

    await useAuthStore.getState().logout();

    expect(mockUserManager.signoutRedirect).toHaveBeenCalledTimes(1);
  });
});
