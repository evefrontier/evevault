import { SUI_DEVNET_CHAIN } from "@mysten/wallet-standard";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useNetwork } from "../useNetwork";

// Mock networkStore
vi.mock("../../stores/networkStore", () => ({
  useNetworkStore: vi.fn(),
}));

import { useNetworkStore } from "../../stores/networkStore";

describe("useNetwork", () => {
  const mockSetChain = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("returns network state", () => {
    it("returns chain from network store", () => {
      vi.mocked(useNetworkStore).mockReturnValue({
        chain: SUI_DEVNET_CHAIN,
        loading: false,
        setChain: mockSetChain,
        // @ts-expect-error Partial mock
        checkNetworkSwitch: vi.fn(),
        forceSetChain: vi.fn(),
      });

      const { result } = renderHook(() => useNetwork());

      expect(result.current.chain).toBe(SUI_DEVNET_CHAIN);
    });

    it("returns loading state from network store", () => {
      vi.mocked(useNetworkStore).mockReturnValue({
        chain: SUI_DEVNET_CHAIN,
        loading: true,
        setChain: mockSetChain,
        // @ts-expect-error Partial mock
        checkNetworkSwitch: vi.fn(),
        forceSetChain: vi.fn(),
      });

      const { result } = renderHook(() => useNetwork());

      expect(result.current.loading).toBe(true);
    });

    it("returns setChain function from network store", () => {
      vi.mocked(useNetworkStore).mockReturnValue({
        chain: SUI_DEVNET_CHAIN,
        loading: false,
        setChain: mockSetChain,
        // @ts-expect-error Partial mock
        checkNetworkSwitch: vi.fn(),
        forceSetChain: vi.fn(),
      });

      const { result } = renderHook(() => useNetwork());

      expect(result.current.setChain).toBe(mockSetChain);
    });
  });

  describe("integration", () => {
    it("provides all expected properties", () => {
      vi.mocked(useNetworkStore).mockReturnValue({
        chain: SUI_DEVNET_CHAIN,
        loading: false,
        setChain: mockSetChain,
        // @ts-expect-error Partial mock
        checkNetworkSwitch: vi.fn(),
        forceSetChain: vi.fn(),
      });

      const { result } = renderHook(() => useNetwork());

      expect(result.current).toHaveProperty("chain");
      expect(result.current).toHaveProperty("loading");
      expect(result.current).toHaveProperty("setChain");
    });

    it("reflects store updates", () => {
      let currentChain = SUI_DEVNET_CHAIN;

      vi.mocked(useNetworkStore).mockImplementation(() => ({
        chain: currentChain,
        loading: false,
        setChain: mockSetChain,
        // @ts-expect-error Partial mock
        checkNetworkSwitch: vi.fn(),
        forceSetChain: vi.fn(),
      }));

      const { result, rerender } = renderHook(() => useNetwork());

      expect(result.current.chain).toBe(SUI_DEVNET_CHAIN);

      // Simulate chain change
      currentChain = "sui:testnet" as typeof SUI_DEVNET_CHAIN;
      rerender();

      expect(result.current.chain).toBe("sui:testnet");
    });
  });
});
