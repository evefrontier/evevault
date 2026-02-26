import { SUI_DEVNET_CHAIN, SUI_TESTNET_CHAIN } from "@mysten/wallet-standard";
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock dependencies before importing the store
vi.mock("@evevault/shared/auth", () => ({
  hasJwtForNetwork: vi.fn(),
  useAuthStore: {
    getState: () => ({
      initialize: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

vi.mock("../../utils/environment", () => ({
  isExtension: vi.fn().mockReturnValue(false),
  isWeb: vi.fn().mockReturnValue(true),
}));

vi.mock("../../utils/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("../deviceStore", () => ({
  useDeviceStore: {
    getState: () => ({
      getNonce: vi.fn(),
      getMaxEpoch: vi.fn(),
      getJwtRandomness: vi.fn(),
      getMaxEpochTimestampMs: vi.fn(),
      initializeForChain: vi.fn(),
      ephemeralPublicKey: null,
      isLocked: false,
    }),
  },
}));

// Import mocked modules after vi.mock calls
import { hasJwtForNetwork } from "@evevault/shared/auth";
import { useDeviceStore } from "../deviceStore";
import { useNetworkStore } from "../networkStore";

describe("Network switching integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset store state
    useNetworkStore.setState({
      chain: SUI_DEVNET_CHAIN,
      loading: false,
    });

    // Default mocks
    vi.mocked(hasJwtForNetwork).mockResolvedValue(false);
  });

  describe("seamless network switch", () => {
    it("switches seamlessly when JWT exists for target network", async () => {
      // Setup: User logged in on both devnet and testnet
      vi.mocked(hasJwtForNetwork).mockResolvedValue(true);

      // Mock valid device data for testnet
      const deviceStore = useDeviceStore.getState();
      vi.mocked(deviceStore.getNonce).mockReturnValue("testnet-nonce");
      vi.mocked(deviceStore.getMaxEpoch).mockReturnValue(100);
      vi.mocked(deviceStore.getJwtRandomness).mockReturnValue("randomness");
      vi.mocked(deviceStore.getMaxEpochTimestampMs).mockReturnValue(
        Date.now() + 3600000
      );

      const result = await useNetworkStore.getState().setChain(SUI_TESTNET_CHAIN);

      expect(result.success).toBe(true);
      expect(result.requiresReauth).toBe(false);
      expect(useNetworkStore.getState().chain).toBe(SUI_TESTNET_CHAIN);
    });

    it("checks for JWT before switching", async () => {
      vi.mocked(hasJwtForNetwork).mockResolvedValue(true);

      const deviceStore = useDeviceStore.getState();
      vi.mocked(deviceStore.getNonce).mockReturnValue("testnet-nonce");
      vi.mocked(deviceStore.getMaxEpoch).mockReturnValue(100);
      vi.mocked(deviceStore.getJwtRandomness).mockReturnValue("randomness");
      vi.mocked(deviceStore.getMaxEpochTimestampMs).mockReturnValue(
        Date.now() + 3600000
      );

      await useNetworkStore.getState().setChain(SUI_TESTNET_CHAIN);

      expect(hasJwtForNetwork).toHaveBeenCalledWith(SUI_TESTNET_CHAIN);
    });

    it("does not switch when already on target network", async () => {
      useNetworkStore.setState({ chain: SUI_DEVNET_CHAIN });

      const result = await useNetworkStore.getState().setChain(SUI_DEVNET_CHAIN);

      expect(result.success).toBe(true);
      expect(result.requiresReauth).toBe(false);
      expect(hasJwtForNetwork).not.toHaveBeenCalled();
    });
  });

  describe("network switch requiring re-auth", () => {
    it("requires re-auth when no JWT exists for target network", async () => {
      // Setup: User only logged in on devnet
      useNetworkStore.setState({ chain: SUI_DEVNET_CHAIN });
      vi.mocked(hasJwtForNetwork).mockResolvedValue(false);

      const result = await useNetworkStore
        .getState()
        .checkNetworkSwitch(SUI_TESTNET_CHAIN);

      expect(result.requiresReauth).toBe(true);
      expect(hasJwtForNetwork).toHaveBeenCalledWith(SUI_TESTNET_CHAIN);
    });

    it("sets requiresReauth flag when switching without JWT", async () => {
      vi.mocked(hasJwtForNetwork).mockResolvedValue(false);

      const result = await useNetworkStore.getState().setChain(SUI_TESTNET_CHAIN);

      expect(result.success).toBe(true);
      expect(result.requiresReauth).toBe(true);
      expect(useNetworkStore.getState().chain).toBe(SUI_TESTNET_CHAIN);
    });

    it("does not require re-auth for same network", async () => {
      const result = await useNetworkStore
        .getState()
        .checkNetworkSwitch(SUI_DEVNET_CHAIN);

      expect(result.requiresReauth).toBe(false);
      expect(hasJwtForNetwork).not.toHaveBeenCalled();
    });
  });

  describe("device data validation", () => {
    it("allows switch when JWT exists with valid device data", async () => {
      vi.mocked(hasJwtForNetwork).mockResolvedValue(true);

      const deviceStore = useDeviceStore.getState();
      vi.mocked(deviceStore.getNonce).mockReturnValue("valid-nonce");
      vi.mocked(deviceStore.getMaxEpoch).mockReturnValue(100);
      vi.mocked(deviceStore.getJwtRandomness).mockReturnValue("valid-randomness");
      vi.mocked(deviceStore.getMaxEpochTimestampMs).mockReturnValue(
        Date.now() + 3600000
      ); // 1 hour from now

      const result = await useNetworkStore.getState().setChain(SUI_TESTNET_CHAIN);

      expect(result.success).toBe(true);
      expect(result.requiresReauth).toBe(false);
    });

    it("allows switch when JWT exists but device data is missing", async () => {
      vi.mocked(hasJwtForNetwork).mockResolvedValue(true);

      const deviceStore = useDeviceStore.getState();
      vi.mocked(deviceStore.getNonce).mockReturnValue(null);
      vi.mocked(deviceStore.getMaxEpoch).mockReturnValue(null);

      const result = await useNetworkStore.getState().setChain(SUI_TESTNET_CHAIN);

      // Switch is allowed, user will need to re-login when using features
      expect(result.success).toBe(true);
      expect(result.requiresReauth).toBe(false);
      expect(useNetworkStore.getState().chain).toBe(SUI_TESTNET_CHAIN);
    });

    it("allows switch when JWT exists but device data is expired", async () => {
      vi.mocked(hasJwtForNetwork).mockResolvedValue(true);

      const deviceStore = useDeviceStore.getState();
      vi.mocked(deviceStore.getNonce).mockReturnValue("expired-nonce");
      vi.mocked(deviceStore.getMaxEpoch).mockReturnValue(100);
      vi.mocked(deviceStore.getJwtRandomness).mockReturnValue("valid-randomness");
      vi.mocked(deviceStore.getMaxEpochTimestampMs).mockReturnValue(
        Date.now() - 3600000
      ); // 1 hour ago

      const result = await useNetworkStore.getState().setChain(SUI_TESTNET_CHAIN);

      // Switch is allowed, but user will need to re-login for transactions
      expect(result.success).toBe(true);
      expect(result.requiresReauth).toBe(false);
    });
  });

  describe("force network switch", () => {
    it("forces network switch without checking JWT", () => {
      useNetworkStore.setState({ chain: SUI_DEVNET_CHAIN });

      useNetworkStore.getState().forceSetChain(SUI_TESTNET_CHAIN);

      expect(useNetworkStore.getState().chain).toBe(SUI_TESTNET_CHAIN);
      expect(hasJwtForNetwork).not.toHaveBeenCalled();
    });

    it("does not change chain if already on target", () => {
      useNetworkStore.setState({ chain: SUI_TESTNET_CHAIN });

      useNetworkStore.getState().forceSetChain(SUI_TESTNET_CHAIN);

      expect(useNetworkStore.getState().chain).toBe(SUI_TESTNET_CHAIN);
    });
  });

  describe("edge cases", () => {
    it("handles rapid network switches", async () => {
      vi.mocked(hasJwtForNetwork).mockResolvedValue(true);

      const deviceStore = useDeviceStore.getState();
      vi.mocked(deviceStore.getNonce).mockReturnValue("nonce");
      vi.mocked(deviceStore.getMaxEpoch).mockReturnValue(100);
      vi.mocked(deviceStore.getJwtRandomness).mockReturnValue("randomness");
      vi.mocked(deviceStore.getMaxEpochTimestampMs).mockReturnValue(
        Date.now() + 3600000
      );

      // Switch to testnet
      const result1 = await useNetworkStore.getState().setChain(SUI_TESTNET_CHAIN);
      expect(result1.success).toBe(true);

      // Switch back to devnet
      const result2 = await useNetworkStore.getState().setChain(SUI_DEVNET_CHAIN);
      expect(result2.success).toBe(true);

      expect(useNetworkStore.getState().chain).toBe(SUI_DEVNET_CHAIN);
    });

    it("maintains state after failed JWT check", async () => {
      const originalChain = SUI_DEVNET_CHAIN;
      useNetworkStore.setState({ chain: originalChain });

      vi.mocked(hasJwtForNetwork).mockRejectedValue(new Error("Network error"));

      try {
        await useNetworkStore.getState().checkNetworkSwitch(SUI_TESTNET_CHAIN);
      } catch (error) {
        // Error should be caught and handled
      }

      // Chain should remain unchanged on error
      expect(useNetworkStore.getState().chain).toBe(originalChain);
    });
  });

  describe("multi-network scenarios", () => {
    it("handles user logged in on multiple networks", async () => {
      vi.mocked(hasJwtForNetwork).mockResolvedValue(true);

      const deviceStore = useDeviceStore.getState();
      vi.mocked(deviceStore.getNonce).mockReturnValue("nonce");
      vi.mocked(deviceStore.getMaxEpoch).mockReturnValue(100);
      vi.mocked(deviceStore.getJwtRandomness).mockReturnValue("randomness");
      vi.mocked(deviceStore.getMaxEpochTimestampMs).mockReturnValue(
        Date.now() + 3600000
      );

      // Switch to testnet
      const result1 = await useNetworkStore.getState().setChain(SUI_TESTNET_CHAIN);
      expect(result1.requiresReauth).toBe(false);

      // Switch to mainnet (assuming JWT exists)
      const result2 = await useNetworkStore.getState().setChain("sui:mainnet" as any);
      expect(result2.requiresReauth).toBe(false);
    });

    it("requires re-auth only for networks without JWT", async () => {
      // User has JWT for devnet and testnet, but not mainnet
      vi.mocked(hasJwtForNetwork).mockImplementation(async (chain) => {
        return chain === SUI_DEVNET_CHAIN || chain === SUI_TESTNET_CHAIN;
      });

      const deviceStore = useDeviceStore.getState();
      vi.mocked(deviceStore.getNonce).mockReturnValue("nonce");
      vi.mocked(deviceStore.getMaxEpoch).mockReturnValue(100);
      vi.mocked(deviceStore.getJwtRandomness).mockReturnValue("randomness");
      vi.mocked(deviceStore.getMaxEpochTimestampMs).mockReturnValue(
        Date.now() + 3600000
      );

      // Switch to testnet (has JWT)
      const result1 = await useNetworkStore.getState().setChain(SUI_TESTNET_CHAIN);
      expect(result1.requiresReauth).toBe(false);

      // Switch to mainnet (no JWT)
      const result2 = await useNetworkStore.getState().setChain("sui:mainnet" as any);
      expect(result2.requiresReauth).toBe(true);
    });
  });
});
