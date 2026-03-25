import { Ed25519PublicKey } from "@mysten/sui/keypairs/ed25519";
import { SUI_DEVNET_CHAIN, SUI_TESTNET_CHAIN } from "@mysten/wallet-standard";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DeviceState } from "../../types";
import { createInitActions } from "../deviceStore/actions/initActions";
import type {
  GetDeviceState,
  SetDeviceState,
} from "../deviceStore/actions/types";

const getCurrentEpochFromGraphQLMock = vi.fn();

vi.mock("../../sui/graphqlEpoch", () => ({
  getCurrentEpochFromGraphQL: (...args: unknown[]) =>
    getCurrentEpochFromGraphQLMock(...args),
}));

function stubAsync() {
  return Promise.resolve();
}

function baseDeviceState(
  ephemeralPublicKey: Ed25519PublicKey,
): Omit<DeviceState, "initialize" | "initializeForChain"> {
  return {
    isLocked: true,
    ephemeralPublicKey,
    ephemeralPublicKeyBytes: null,
    ephemeralPublicKeyFlag: null,
    ephemeralKeyPairSecretKey: null,
    networkData: {
      [SUI_TESTNET_CHAIN]: {
        nonce: "existing",
        maxEpoch: "1",
        maxEpochTimestampMs: 99,
        jwtRandomness: "jr",
      },
    },
    loading: false,
    error: null,
    getZkProof: async () => ({ error: "stub" }),
    lock: stubAsync,
    unlock: stubAsync,
    reset: () => {},
    getMaxEpoch: () => null,
    getMaxEpochTimestampMs: () => null,
    getNonce: () => null,
    getJwtRandomness: () => null,
  };
}

function buildInitHarness(
  ephemeralPublicKey: Ed25519PublicKey | null,
  extra: Partial<DeviceState> = {},
) {
  let state: DeviceState;

  const set: SetDeviceState = (update) => {
    const partial = typeof update === "function" ? update(state) : update;
    Object.assign(state, partial);
  };

  const get: GetDeviceState = () => state;

  const { initialize, initializeForChain } = createInitActions(set, get);

  const pub =
    ephemeralPublicKey ?? new Ed25519PublicKey(new Uint8Array(32).fill(1));

  state = {
    ...baseDeviceState(pub),
    ...extra,
    ephemeralPublicKey,
    initialize,
    initializeForChain,
  };

  return { state, initialize, initializeForChain, get, set };
}

describe("createInitActions", () => {
  const epochMs = Date.now() + 120_000;

  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentEpochFromGraphQLMock.mockResolvedValue({
      numericMaxEpoch: 777,
      maxEpochTimestampMs: epochMs,
    });
  });

  describe("initialize", () => {
    it("sets PIN error and clears loading when PIN is empty", async () => {
      const pub = new Ed25519PublicKey(new Uint8Array(32).fill(2));
      const { initialize, state } = buildInitHarness(pub);

      await initialize("");

      expect(state.error).toBe("PIN is required");
      expect(state.loading).toBe(false);
    });

    it("sets PIN error when PIN is only whitespace", async () => {
      const pub = new Ed25519PublicKey(new Uint8Array(32).fill(2));
      const { initialize, state } = buildInitHarness(pub);

      await initialize("   ");

      expect(state.error).toBe("PIN is required");
      expect(state.loading).toBe(false);
    });
  });

  describe("initializeForChain", () => {
    it("throws when ephemeral public key is missing", async () => {
      const { initializeForChain } = buildInitHarness(null);

      await expect(initializeForChain(SUI_DEVNET_CHAIN)).rejects.toThrow(
        "Ephemeral public key not found",
      );
    });

    it("writes network data for the chain and preserves other chains", async () => {
      const pub = new Ed25519PublicKey(new Uint8Array(32).fill(3));
      const { initializeForChain, state } = buildInitHarness(pub);

      await initializeForChain(SUI_DEVNET_CHAIN);

      expect(state.error).toBeNull();
      const dev = state.networkData[SUI_DEVNET_CHAIN];
      expect(dev?.maxEpoch).toBe("777");
      expect(dev?.maxEpochTimestampMs).toBe(epochMs);
      expect(dev?.nonce).toEqual(expect.any(String));
      expect(dev?.jwtRandomness).toEqual(expect.any(String));
      expect(state.networkData[SUI_TESTNET_CHAIN]?.nonce).toBe("existing");
      expect(getCurrentEpochFromGraphQLMock).toHaveBeenCalledWith(
        SUI_DEVNET_CHAIN,
      );
    });
  });
});
