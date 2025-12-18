import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as vaultService from "../../services/vaultService";
import { useDeviceStore } from "../deviceStore";

// Mock the keeper service
vi.mock("../../services/vaultService", () => ({
  ephKeyService: {
    lock: vi.fn(),
  },
  zkProofService: {},
}));

describe("deviceStore.lock()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state before each test
    useDeviceStore.setState({
      isLocked: false,
      ephemeralPublicKey: null,
      ephemeralPublicKeyBytes: null,
      ephemeralKeyPairSecretKey: null,
      jwtRandomness: null,
      networkData: {},
      loading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls ephKeyService.lock() and sets isLocked to true", async () => {
    const mockLock = vi.mocked(vaultService.ephKeyService.lock);
    mockLock.mockResolvedValueOnce(undefined);

    await useDeviceStore.getState().lock();

    expect(mockLock).toHaveBeenCalledTimes(1);
    expect(useDeviceStore.getState().isLocked).toBe(true);
  });

  it("sets isLocked to true even if already locked", async () => {
    useDeviceStore.setState({ isLocked: true });
    const mockLock = vi.mocked(vaultService.ephKeyService.lock);
    mockLock.mockResolvedValueOnce(undefined);

    await useDeviceStore.getState().lock();

    expect(mockLock).toHaveBeenCalledTimes(1);
    expect(useDeviceStore.getState().isLocked).toBe(true);
  });

  it("handles error when ephKeyService.lock() fails", async () => {
    const mockLock = vi.mocked(vaultService.ephKeyService.lock);
    const error = new Error("Keeper lock failed");
    mockLock.mockRejectedValueOnce(error);

    await expect(useDeviceStore.getState().lock()).rejects.toThrow(
      "Keeper lock failed",
    );

    expect(mockLock).toHaveBeenCalledTimes(1);
    // State should not change if lock fails
    expect(useDeviceStore.getState().isLocked).toBe(false);
  });
});
