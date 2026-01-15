import { SUI_DEVNET_CHAIN, SUI_TESTNET_CHAIN } from "@mysten/wallet-standard";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies before importing the store
// Note: vi.mock is hoisted, so we use vi.fn() directly in the mock factory
// Using workspace alias in test files due to Vite resolution limitations with relative imports
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
// Using workspace alias in test files due to Vite resolution limitations with relative imports
import { hasJwtForNetwork } from "@evevault/shared/auth";
import { useDeviceStore } from "../deviceStore";
import { useNetworkStore } from "../networkStore";

describe("networkStore", () => {
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("checkNetworkSwitch", () => {
    it("returns requiresReauth: false for same chain", async () => {
      useNetworkStore.setState({ chain: SUI_DEVNET_CHAIN });

      const result = await useNetworkStore
        .getState()
        .checkNetworkSwitch(SUI_DEVNET_CHAIN);

      expect(result.requiresReauth).toBe(false);
      expect(hasJwtForNetwork).not.toHaveBeenCalled();
    });

    it("returns requiresReauth: false when JWT exists for target chain", async () => {
      useNetworkStore.setState({ chain: SUI_DEVNET_CHAIN });
      vi.mocked(hasJwtForNetwork).mockResolvedValue(true);

      const result = await useNetworkStore
        .getState()
        .checkNetworkSwitch(SUI_TESTNET_CHAIN);

      expect(result.requiresReauth).toBe(false);
      expect(hasJwtForNetwork).toHaveBeenCalledWith(SUI_TESTNET_CHAIN);
    });

    it("returns requiresReauth: true when no JWT exists for target chain", async () => {
      useNetworkStore.setState({ chain: SUI_DEVNET_CHAIN });
      vi.mocked(hasJwtForNetwork).mockResolvedValue(false);

      const result = await useNetworkStore
        .getState()
        .checkNetworkSwitch(SUI_TESTNET_CHAIN);

      expect(result.requiresReauth).toBe(true);
      expect(hasJwtForNetwork).toHaveBeenCalledWith(SUI_TESTNET_CHAIN);
    });
  });

  describe("forceSetChain", () => {
    it("sets chain directly without checking JWT", () => {
      useNetworkStore.setState({ chain: SUI_DEVNET_CHAIN });

      useNetworkStore.getState().forceSetChain(SUI_TESTNET_CHAIN);

      expect(useNetworkStore.getState().chain).toBe(SUI_TESTNET_CHAIN);
      expect(hasJwtForNetwork).not.toHaveBeenCalled();
    });

    it("does not change chain if already on target chain", () => {
      useNetworkStore.setState({ chain: SUI_TESTNET_CHAIN });

      useNetworkStore.getState().forceSetChain(SUI_TESTNET_CHAIN);

      expect(useNetworkStore.getState().chain).toBe(SUI_TESTNET_CHAIN);
    });
  });

  describe("setChain", () => {
    it("returns success without reauth for same chain", async () => {
      useNetworkStore.setState({ chain: SUI_DEVNET_CHAIN });

      const result = await useNetworkStore
        .getState()
        .setChain(SUI_DEVNET_CHAIN);

      expect(result.success).toBe(true);
      expect(result.requiresReauth).toBe(false);
    });

    it("returns requiresReauth: true when no JWT for target chain", async () => {
      useNetworkStore.setState({ chain: SUI_DEVNET_CHAIN });
      vi.mocked(hasJwtForNetwork).mockResolvedValue(false);

      const result = await useNetworkStore
        .getState()
        .setChain(SUI_TESTNET_CHAIN);

      expect(result.success).toBe(true);
      expect(result.requiresReauth).toBe(true);
      expect(useNetworkStore.getState().chain).toBe(SUI_TESTNET_CHAIN);
    });

    it("does NOT regenerate device data when switching to network without JWT", async () => {
      useNetworkStore.setState({ chain: SUI_DEVNET_CHAIN });
      vi.mocked(hasJwtForNetwork).mockResolvedValue(false);

      const deviceStore = useDeviceStore.getState();
      await useNetworkStore.getState().setChain(SUI_TESTNET_CHAIN);

      // Should NOT call initializeForChain - device data only created during login
      expect(deviceStore.initializeForChain).not.toHaveBeenCalled();
    });

    it("performs seamless switch when JWT and valid device data exist", async () => {
      useNetworkStore.setState({ chain: SUI_DEVNET_CHAIN });
      vi.mocked(hasJwtForNetwork).mockResolvedValue(true);

      // Mock valid device data
      const deviceStore = useDeviceStore.getState();
      vi.mocked(deviceStore.getNonce).mockReturnValue("valid-nonce");
      vi.mocked(deviceStore.getMaxEpoch).mockReturnValue(100);
      vi.mocked(deviceStore.getJwtRandomness).mockReturnValue(
        "valid-randomness",
      );
      vi.mocked(deviceStore.getMaxEpochTimestampMs).mockReturnValue(
        Date.now() + 3600000,
      ); // 1 hour

      const result = await useNetworkStore
        .getState()
        .setChain(SUI_TESTNET_CHAIN);

      expect(result.success).toBe(true);
      expect(result.requiresReauth).toBe(false);
      expect(useNetworkStore.getState().chain).toBe(SUI_TESTNET_CHAIN);
    });

    it("allows switch when JWT exists but device data is missing (re-login will be required)", async () => {
      useNetworkStore.setState({ chain: SUI_DEVNET_CHAIN });
      vi.mocked(hasJwtForNetwork).mockResolvedValue(true);

      // Mock missing device data
      const deviceStore = useDeviceStore.getState();
      vi.mocked(deviceStore.getNonce).mockReturnValue(null);
      vi.mocked(deviceStore.getMaxEpoch).mockReturnValue(null);

      const result = await useNetworkStore
        .getState()
        .setChain(SUI_TESTNET_CHAIN);

      // Switch is allowed, but user will need to re-login when using features
      expect(result.success).toBe(true);
      expect(result.requiresReauth).toBe(false);
      expect(useNetworkStore.getState().chain).toBe(SUI_TESTNET_CHAIN);

      // Should NOT regenerate device data (would cause nonce mismatch)
      expect(deviceStore.initializeForChain).not.toHaveBeenCalled();
    });

    it("allows switch when JWT exists but device data is expired", async () => {
      useNetworkStore.setState({ chain: SUI_DEVNET_CHAIN });
      vi.mocked(hasJwtForNetwork).mockResolvedValue(true);

      // Mock expired device data
      const deviceStore = useDeviceStore.getState();
      vi.mocked(deviceStore.getNonce).mockReturnValue("expired-nonce");
      vi.mocked(deviceStore.getMaxEpoch).mockReturnValue(100);
      vi.mocked(deviceStore.getJwtRandomness).mockReturnValue(
        "valid-randomness",
      );
      vi.mocked(deviceStore.getMaxEpochTimestampMs).mockReturnValue(
        Date.now() - 3600000,
      ); // 1 hour ago

      const result = await useNetworkStore
        .getState()
        .setChain(SUI_TESTNET_CHAIN);

      // Switch is allowed, but user will need to re-login for transactions
      expect(result.success).toBe(true);
      expect(result.requiresReauth).toBe(false);

      // Should NOT regenerate device data (would cause nonce mismatch with existing JWT)
      expect(deviceStore.initializeForChain).not.toHaveBeenCalled();
    });
  });
});
