import { Ed25519PublicKey } from "@mysten/sui/keypairs/ed25519";
import { SUI_DEVNET_CHAIN, SUI_TESTNET_CHAIN } from "@mysten/wallet-standard";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInitActions } from "#/stores/deviceStore/actions/initActions";
import type {
  GetDeviceState,
  SetDeviceState,
} from "#/stores/deviceStore/actions/types";
import { useNetworkStore } from "#/stores/networkStore";
import type { DeviceState } from "#/types";

const getCurrentEpochFromGraphQLMock = vi.fn();
const rotateEphemeralKeyPairMock = vi.fn();
const clearAllZkLoginJwtsMock = vi.fn();
const clearZkProofsMock = vi.fn();

vi.mock("#/sui/graphqlEpoch", () => ({
  getCurrentEpochFromGraphQL: (...args: unknown[]) =>
    getCurrentEpochFromGraphQLMock(...args),
}));

vi.mock("#/services/vaultService", () => ({
  ephKeyService: {
    initialize: vi.fn(),
    hasKeypair: vi.fn(),
    isUnlocked: vi.fn(() => false),
    unlockVault: vi.fn(),
    createEphemeralKeyPair: vi.fn(),
    rotateEphemeralKeyPair: (...args: unknown[]) =>
      rotateEphemeralKeyPairMock(...args),
    getEphemeralPublicKey: vi.fn(),
  },
  zkProofService: {
    clear: (...args: unknown[]) => clearZkProofsMock(...args),
  },
}));

vi.mock("#/auth/storageService", () => ({
  clearAllZkLoginJwts: (...args: unknown[]) => clearAllZkLoginJwtsMock(...args),
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
    rotateEphemeralKey: stubAsync,
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

  const { initialize, initializeForChain, rotateEphemeralKey } =
    createInitActions(set, get);

  const pub =
    ephemeralPublicKey ?? new Ed25519PublicKey(new Uint8Array(32).fill(1));

  state = {
    ...baseDeviceState(pub),
    ...extra,
    ephemeralPublicKey,
    initialize,
    initializeForChain,
    rotateEphemeralKey,
  };

  return { state, initialize, initializeForChain, get, set };
}

describe("createInitActions", () => {
  const epochMs = Date.now() + 120_000;

  beforeEach(() => {
    vi.clearAllMocks();
    useNetworkStore.setState({ chain: SUI_DEVNET_CHAIN, loading: false });
    getCurrentEpochFromGraphQLMock.mockResolvedValue({
      numericMaxEpoch: 777,
      maxEpochTimestampMs: epochMs,
    });
    clearAllZkLoginJwtsMock.mockResolvedValue(undefined);
    clearZkProofsMock.mockResolvedValue(undefined);
    rotateEphemeralKeyPairMock.mockResolvedValue({
      hashedSecretKey: { iv: "new", data: "secret", salt: "salt" },
      publicKey: new Ed25519PublicKey(new Uint8Array(32).fill(8)),
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

  describe("rotateEphemeralKey", () => {
    it("replaces the key and resets derived state before reinitializing current chain", async () => {
      const pub = new Ed25519PublicKey(new Uint8Array(32).fill(3));
      const { state } = buildInitHarness(pub, {
        ephemeralKeyPairSecretKey: { iv: "old", data: "old", salt: "old" },
        networkData: {
          [SUI_DEVNET_CHAIN]: {
            nonce: "stale",
            maxEpoch: "10",
            maxEpochTimestampMs: Date.now() - 1000,
            jwtRandomness: "stale-random",
          },
          [SUI_TESTNET_CHAIN]: {
            nonce: "other",
            maxEpoch: "11",
            maxEpochTimestampMs: Date.now() + 1000,
            jwtRandomness: "other-random",
          },
        },
      });

      await state.rotateEphemeralKey();

      expect(rotateEphemeralKeyPairMock).toHaveBeenCalledTimes(1);
      expect(clearAllZkLoginJwtsMock).toHaveBeenCalledTimes(1);
      expect(clearZkProofsMock).toHaveBeenCalledTimes(1);
      expect(state.ephemeralKeyPairSecretKey).toEqual({
        iv: "web-crypto-signer",
        data: "non-extractable-key",
        salt: "web-crypto-salt",
      });
      expect(state.networkData[SUI_DEVNET_CHAIN]?.maxEpoch).toBe("777");
      expect(state.networkData[SUI_DEVNET_CHAIN]?.nonce).toEqual(
        expect.any(String),
      );
      expect(state.networkData[SUI_TESTNET_CHAIN]?.nonce).toBeNull();
    });
  });
});
