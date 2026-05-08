import { SUI_DEVNET_CHAIN, SUI_TESTNET_CHAIN } from "@mysten/wallet-standard";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies before importing the store
// Note: vi.mock is hoisted, so we use vi.fn() directly in the mock factory
// Using workspace alias in test files due to Vite resolution limitations with relative imports
vi.mock("#/auth", () => ({
  hasJwt: vi.fn(),
  useAuthStore: {
    getState: () => ({
      initialize: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

vi.mock("#/utils/environment", () => ({
  isExtension: vi.fn().mockReturnValue(false),
  isWeb: vi.fn().mockReturnValue(true),
}));

vi.mock("#/utils/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const mockDeviceStoreState = vi.hoisted(() => ({
  networkData: {} as Record<string, unknown>,
  initializeForChain: vi.fn().mockResolvedValue(undefined),
  ephemeralPublicKey: null as string | null,
  isLocked: false,
}));

vi.mock("#/stores/deviceStore", () => ({
  useDeviceStore: {
    getState: () => mockDeviceStoreState,
  },
}));

// Import mocked modules after vi.mock calls
// Using workspace alias in test files due to Vite resolution limitations with relative imports
import { hasJwt } from "#/auth";
import { useContextStore } from "#/stores/contextStore";

describe("contextStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeviceStoreState.networkData = {};

    // Reset store state
    useContextStore.setState({
      chain: SUI_DEVNET_CHAIN,
      loading: false,
    });

    // Default mocks
    vi.mocked(hasJwt).mockResolvedValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("checkNetworkSwitch", () => {
    it("returns requiresReauth: false for same chain", async () => {
      useContextStore.setState({ chain: SUI_DEVNET_CHAIN });

      const result = await useContextStore
        .getState()
        .checkNetworkSwitch(SUI_DEVNET_CHAIN);

      expect(result.requiresReauth).toBe(false);
      expect(hasJwt).not.toHaveBeenCalled();
    });

    it("returns requiresReauth: false when JWT exists for target chain", async () => {
      useContextStore.setState({ chain: SUI_DEVNET_CHAIN });
      vi.mocked(hasJwt).mockResolvedValue(true);

      const result = await useContextStore
        .getState()
        .checkNetworkSwitch(SUI_TESTNET_CHAIN);

      expect(result.requiresReauth).toBe(false);
      expect(hasJwt).toHaveBeenCalled();
    });

    it("returns requiresReauth: true when no JWT exists for target chain", async () => {
      useContextStore.setState({ chain: SUI_DEVNET_CHAIN });
      vi.mocked(hasJwt).mockResolvedValue(false);

      const result = await useContextStore
        .getState()
        .checkNetworkSwitch(SUI_TESTNET_CHAIN);

      expect(result.requiresReauth).toBe(true);
      expect(hasJwt).toHaveBeenCalled();
    });
  });

  describe("forceSetChain", () => {
    it("sets chain directly without checking JWT", () => {
      useContextStore.setState({ chain: SUI_DEVNET_CHAIN });

      useContextStore.getState().forceSetChain(SUI_TESTNET_CHAIN);

      expect(useContextStore.getState().chain).toBe(SUI_TESTNET_CHAIN);
      expect(hasJwt).not.toHaveBeenCalled();
    });

    it("does not change chain if already on target chain", () => {
      useContextStore.setState({ chain: SUI_TESTNET_CHAIN });

      useContextStore.getState().forceSetChain(SUI_TESTNET_CHAIN);

      expect(useContextStore.getState().chain).toBe(SUI_TESTNET_CHAIN);
    });
  });

  describe("setChain", () => {
    it("returns success without reauth for same chain", async () => {
      useContextStore.setState({ chain: SUI_DEVNET_CHAIN });

      const result = await useContextStore
        .getState()
        .setChain(SUI_DEVNET_CHAIN);

      expect(result.success).toBe(true);
      expect(result.requiresReauth).toBe(false);
    });

    it("returns requiresReauth: true when no JWT for target chain", async () => {
      useContextStore.setState({ chain: SUI_DEVNET_CHAIN });
      vi.mocked(hasJwt).mockResolvedValue(false);

      const result = await useContextStore
        .getState()
        .setChain(SUI_TESTNET_CHAIN);

      expect(result.success).toBe(true);
      expect(result.requiresReauth).toBe(true);
      expect(useContextStore.getState().chain).toBe(SUI_TESTNET_CHAIN);
    });

    it("pre-initializes device data when switching to network without JWT", async () => {
      useContextStore.setState({ chain: SUI_DEVNET_CHAIN });
      vi.mocked(hasJwt).mockResolvedValue(false);

      await useContextStore.getState().setChain(SUI_TESTNET_CHAIN);

      // Pre-initializes device data so it's ready for vendJwt after login
      expect(mockDeviceStoreState.initializeForChain).toHaveBeenCalledWith(
        SUI_TESTNET_CHAIN,
      );
    });

    it("performs seamless switch when JWT exists", async () => {
      useContextStore.setState({ chain: SUI_DEVNET_CHAIN });
      vi.mocked(hasJwt).mockResolvedValue(true);

      const result = await useContextStore
        .getState()
        .setChain(SUI_TESTNET_CHAIN);

      expect(result.success).toBe(true);
      expect(result.requiresReauth).toBe(false);
      expect(useContextStore.getState().chain).toBe(SUI_TESTNET_CHAIN);
      expect(mockDeviceStoreState.initializeForChain).toHaveBeenCalledWith(
        SUI_TESTNET_CHAIN,
      );
    });

    it("allows switch and regenerates device data when JWT exists but device data is missing", async () => {
      useContextStore.setState({ chain: SUI_DEVNET_CHAIN });
      vi.mocked(hasJwt).mockResolvedValue(true);

      const result = await useContextStore
        .getState()
        .setChain(SUI_TESTNET_CHAIN);

      expect(result.success).toBe(true);
      expect(result.requiresReauth).toBe(false);
      expect(useContextStore.getState().chain).toBe(SUI_TESTNET_CHAIN);
      expect(mockDeviceStoreState.initializeForChain).toHaveBeenCalledWith(
        SUI_TESTNET_CHAIN,
      );
    });

    it("allows switch and regenerates device data when JWT exists but device data is expired", async () => {
      useContextStore.setState({ chain: SUI_DEVNET_CHAIN });
      vi.mocked(hasJwt).mockResolvedValue(true);
      mockDeviceStoreState.networkData = {
        [SUI_TESTNET_CHAIN]: {
          nonce: "existing-nonce",
          maxEpoch: 100,
          maxEpochTimestampMs: Date.now() - 10_000, // expired
        },
      };

      const result = await useContextStore
        .getState()
        .setChain(SUI_TESTNET_CHAIN);

      expect(result.success).toBe(true);
      expect(result.requiresReauth).toBe(false);
      expect(mockDeviceStoreState.initializeForChain).toHaveBeenCalledWith(
        SUI_TESTNET_CHAIN,
      );
    });
  });
});
