import { SUI_DEVNET_CHAIN } from "@mysten/wallet-standard";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockUser } from "../../testing/createMockUser";
import { useEpochExpiration } from "../useEpochExpiration";

// Mock dependencies
vi.mock("../../auth/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../stores/deviceStore", () => ({
  useDeviceStore: vi.fn(),
}));

vi.mock("../../stores/networkStore", () => ({
  useNetworkStore: vi.fn(),
}));

import { useAuth } from "../../auth/hooks/useAuth";
import { useDeviceStore } from "../../stores/deviceStore";
import { useNetworkStore } from "../../stores/networkStore";

describe("useEpochExpiration", () => {
  const mockLogout = vi.fn();
  const mockGetMaxEpochTimestampMs = vi.fn();
  const mockUser = createMockUser();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    vi.mocked(useAuth).mockReturnValue({
      logout: mockLogout,
      user: mockUser,
      login: vi.fn(),
      extensionLogin: vi.fn(),
      setUser: vi.fn(),
      refreshJwt: vi.fn(),
      loading: false,
      error: null,
      isAuthenticated: true,
      initialize: vi.fn(),
    } as any);

    vi.mocked(useNetworkStore).mockReturnValue({
      chain: SUI_DEVNET_CHAIN,
    } as any);

    vi.mocked(useDeviceStore).mockImplementation((selector) => {
      const mockState = {
        getMaxEpochTimestampMs: mockGetMaxEpochTimestampMs,
      };
      return selector(mockState);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("does nothing when maxEpochTimestampMs is null", () => {
    mockGetMaxEpochTimestampMs.mockReturnValue(null);

    renderHook(() => useEpochExpiration());

    expect(mockLogout).not.toHaveBeenCalled();
  });

  it("does nothing when user is not logged in", () => {
    const futureTimestamp = Date.now() + 1000;
    mockGetMaxEpochTimestampMs.mockReturnValue(futureTimestamp);
    vi.mocked(useAuth).mockReturnValue({
      logout: mockLogout,
      user: null,
      login: vi.fn(),
      extensionLogin: vi.fn(),
      setUser: vi.fn(),
      refreshJwt: vi.fn(),
      loading: false,
      error: null,
      isAuthenticated: false,
      initialize: vi.fn(),
    } as any);

    renderHook(() => useEpochExpiration());

    // Advance time past expiration
    vi.advanceTimersByTime(2000);

    expect(mockLogout).not.toHaveBeenCalled();
  });

  it("immediately logs out if already expired on mount", () => {
    const pastTimestamp = Date.now() - 10000;
    mockGetMaxEpochTimestampMs.mockReturnValue(pastTimestamp);

    renderHook(() => useEpochExpiration());

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it("uses 5 minute polling interval when > 1 hour until expiration", () => {
    const futureTimestamp = Date.now() + 2 * 60 * 60 * 1000; // 2 hours
    mockGetMaxEpochTimestampMs.mockReturnValue(futureTimestamp);

    renderHook(() => useEpochExpiration());

    // Should not be called immediately
    expect(mockLogout).not.toHaveBeenCalled();

    // Advance by 5 minutes - should check but not expire
    vi.advanceTimersByTime(5 * 60 * 1000);
    expect(mockLogout).not.toHaveBeenCalled();

    // Advance to expiration
    vi.advanceTimersByTime(2 * 60 * 60 * 1000 - 5 * 60 * 1000);
    expect(mockLogout).toHaveBeenCalled();
  });

  it("uses 30 second polling interval when < 1 hour until expiration", () => {
    const futureTimestamp = Date.now() + 30 * 60 * 1000; // 30 minutes
    mockGetMaxEpochTimestampMs.mockReturnValue(futureTimestamp);

    renderHook(() => useEpochExpiration());

    // Advance by 30 seconds - should check but not expire
    vi.advanceTimersByTime(30 * 1000);
    expect(mockLogout).not.toHaveBeenCalled();

    // Advance to expiration
    vi.advanceTimersByTime(30 * 60 * 1000 - 30 * 1000);
    expect(mockLogout).toHaveBeenCalled();
  });

  it("cleans up interval on unmount", () => {
    const futureTimestamp = Date.now() + 10000;
    mockGetMaxEpochTimestampMs.mockReturnValue(futureTimestamp);

    const { unmount } = renderHook(() => useEpochExpiration());

    unmount();

    // Advance time past expiration
    vi.advanceTimersByTime(15000);

    // Should not call logout after unmount
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it("adjusts polling interval dynamically as expiration approaches", () => {
    // Start with > 1 hour until expiration
    const currentTime = Date.now();
    const futureTimestamp = currentTime + 2 * 60 * 60 * 1000; // 2 hours
    mockGetMaxEpochTimestampMs.mockReturnValue(futureTimestamp);

    renderHook(() => useEpochExpiration());

    // First check should be at 5 minute interval
    vi.advanceTimersByTime(5 * 60 * 1000);
    expect(mockLogout).not.toHaveBeenCalled();

    // Advance time so we cross the 1-hour threshold
    // Advance 1 hour and 5 minutes (65 minutes) so we're now < 1 hour remaining
    // This should trigger interval adjustment to 30 seconds
    vi.advanceTimersByTime(65 * 60 * 1000);
    expect(mockLogout).not.toHaveBeenCalled();

    // The hook should adjust to 30 second intervals
    // Advance by 30 seconds
    vi.advanceTimersByTime(30 * 1000);
    expect(mockLogout).not.toHaveBeenCalled();

    // Advance the remaining time to expiration (55 minutes - 30 seconds = 54.5 minutes)
    vi.advanceTimersByTime(54 * 60 * 1000 - 30 * 1000);
    expect(mockLogout).toHaveBeenCalled();
  });

  it("logs out when expiration time is reached", () => {
    const futureTimestamp = Date.now() + 5000;
    mockGetMaxEpochTimestampMs.mockReturnValue(futureTimestamp);

    renderHook(() => useEpochExpiration());

    // Should not be called immediately (timestamp is 5 seconds in future)
    expect(mockLogout).not.toHaveBeenCalled();

    // Advance time past expiration AND past the interval duration (30 seconds)
    // so the interval callback fires and checks expiration
    vi.advanceTimersByTime(30000); // 30 seconds - interval fires, checks expiration

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
