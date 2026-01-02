import { SUI_DEVNET_CHAIN, SUI_TESTNET_CHAIN } from "@mysten/wallet-standard";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDevice } from "../useDevice";

// Mock dependencies
vi.mock("../../stores/deviceStore", () => ({
  useDeviceStore: vi.fn(),
}));

vi.mock("../../stores/networkStore", () => ({
  useNetworkStore: vi.fn(),
}));

import { useDeviceStore } from "../../stores/deviceStore";
import { useNetworkStore } from "../../stores/networkStore";

describe("useDevice", () => {
  const mockNetworkData = {
    [SUI_DEVNET_CHAIN]: {
      nonce: "devnet-nonce-123",
      maxEpoch: 100,
      maxEpochTimestampMs: Date.now() + 3600000, // 1 hour from now
      jwtRandomness: "devnet-randomness",
    },
    [SUI_TESTNET_CHAIN]: {
      nonce: "testnet-nonce-456",
      maxEpoch: 200,
      maxEpochTimestampMs: Date.now() + 7200000, // 2 hours from now
      jwtRandomness: "testnet-randomness",
    },
  };

  const mockDeviceStoreState = {
    isLocked: false,
    ephemeralPublicKeyBytes: null,
    ephemeralPublicKeyFlag: 0,
    ephemeralKeyPairSecretKey: null,
    jwtRandomness: null,
    loading: false,
    error: null,
    initialize: vi.fn(),
    initializeForChain: vi.fn(),
    getZkProof: vi.fn(),
    unlock: vi.fn(),
    lock: vi.fn(),
    networkData: mockNetworkData,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for network store - devnet
    vi.mocked(useNetworkStore).mockReturnValue({
      chain: SUI_DEVNET_CHAIN,
      // biome-ignore lint/suspicious/noExplicitAny: Test mocking requires any type
    } as any);

    // Mock useDeviceStore to handle both direct calls and selector calls
    vi.mocked(useDeviceStore).mockImplementation((selector?: unknown) => {
      if (typeof selector === "function") {
        // Selector call - return selector result
        return (selector as (state: typeof mockDeviceStoreState) => unknown)(
          mockDeviceStoreState,
        );
      }
      // Direct call - return full state
      return mockDeviceStoreState;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("reactive chain subscription", () => {
    it("returns device data for current chain (devnet)", () => {
      const { result } = renderHook(() => useDevice());

      expect(result.current.maxEpoch).toBe(100);
      expect(result.current.nonce).toBe("devnet-nonce-123");
      expect(result.current.maxEpochTimestampMs).toBe(
        mockNetworkData[SUI_DEVNET_CHAIN].maxEpochTimestampMs,
      );
    });

    it("returns device data for testnet when chain changes", () => {
      // Start with testnet
      vi.mocked(useNetworkStore).mockReturnValue({
        chain: SUI_TESTNET_CHAIN,
        // biome-ignore lint/suspicious/noExplicitAny: Test mocking requires any type
      } as any);

      const { result } = renderHook(() => useDevice());

      expect(result.current.maxEpoch).toBe(200);
      expect(result.current.nonce).toBe("testnet-nonce-456");
    });

    it("returns null values when networkData is missing for chain", () => {
      // Mock empty network data
      vi.mocked(useDeviceStore).mockImplementation((selector?: unknown) => {
        const emptyState = {
          ...mockDeviceStoreState,
          networkData: {},
        };
        if (typeof selector === "function") {
          return (selector as (state: typeof emptyState) => unknown)(
            emptyState,
          );
        }
        return emptyState;
      });

      const { result } = renderHook(() => useDevice());

      expect(result.current.maxEpoch).toBeNull();
      expect(result.current.nonce).toBeNull();
      expect(result.current.maxEpochTimestampMs).toBeNull();
    });

    it("updates when networkData changes", () => {
      let currentNetworkData = { ...mockNetworkData };

      vi.mocked(useDeviceStore).mockImplementation((selector?: unknown) => {
        const state = {
          ...mockDeviceStoreState,
          networkData: currentNetworkData,
        };
        if (typeof selector === "function") {
          return (selector as (state: typeof state) => unknown)(state);
        }
        return state;
      });

      const { result, rerender } = renderHook(() => useDevice());

      expect(result.current.maxEpoch).toBe(100);

      // Simulate networkData update
      currentNetworkData = {
        ...currentNetworkData,
        [SUI_DEVNET_CHAIN]: {
          ...currentNetworkData[SUI_DEVNET_CHAIN],
          maxEpoch: 150,
        },
      };

      // Trigger rerender to pick up new data
      rerender();

      expect(result.current.maxEpoch).toBe(150);
    });
  });

  describe("isPinSet computation", () => {
    it("returns true when ephemeralKeyPairSecretKey has iv and data", () => {
      vi.mocked(useDeviceStore).mockImplementation((selector?: unknown) => {
        const state = {
          ...mockDeviceStoreState,
          ephemeralKeyPairSecretKey: {
            iv: "some-iv",
            data: "some-encrypted-data",
          },
        };
        if (typeof selector === "function") {
          return (selector as (state: typeof state) => unknown)(state);
        }
        return state;
      });

      const { result } = renderHook(() => useDevice());

      expect(result.current.isPinSet).toBe(true);
    });

    it("returns false when ephemeralKeyPairSecretKey is null", () => {
      const { result } = renderHook(() => useDevice());

      expect(result.current.isPinSet).toBe(false);
    });

    it("returns false when ephemeralKeyPairSecretKey is missing iv or data", () => {
      vi.mocked(useDeviceStore).mockImplementation((selector?: unknown) => {
        const state = {
          ...mockDeviceStoreState,
          ephemeralKeyPairSecretKey: { iv: "only-iv" }, // missing data
        };
        if (typeof selector === "function") {
          return (selector as (state: typeof state) => unknown)(state);
        }
        return state;
      });

      const { result } = renderHook(() => useDevice());

      expect(result.current.isPinSet).toBe(false);
    });
  });

  describe("returns store functions", () => {
    it("exposes initialize, lock, unlock, and getZkProof functions", () => {
      const { result } = renderHook(() => useDevice());

      expect(result.current.initialize).toBe(mockDeviceStoreState.initialize);
      expect(result.current.lock).toBe(mockDeviceStoreState.lock);
      expect(result.current.unlock).toBe(mockDeviceStoreState.unlock);
      expect(result.current.getZkProof).toBe(mockDeviceStoreState.getZkProof);
      expect(result.current.initializeForChain).toBe(
        mockDeviceStoreState.initializeForChain,
      );
    });
  });
});
