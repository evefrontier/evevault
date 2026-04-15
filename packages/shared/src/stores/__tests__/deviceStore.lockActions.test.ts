import { SUI_DEVNET_CHAIN } from "@mysten/wallet-standard";
import { describe, expect, it, vi } from "vitest";
import * as vaultService from "../../services/vaultService";
import type { DeviceState } from "../../types";
import { createLockActions } from "../deviceStore/actions/lockActions";
import type {
  GetDeviceState,
  SetDeviceState,
} from "../deviceStore/actions/types";
import { createInitialNetworkData } from "../deviceStore/constants";

vi.mock("../../services/vaultService", () => ({
  ephKeyService: {
    lock: vi.fn(),
    isUnlocked: vi.fn(),
    hasKeypair: vi.fn(),
    unlockVault: vi.fn(),
  },
  zkProofService: {},
}));

function stubAsync() {
  return Promise.resolve();
}

function buildLockHarness() {
  let state: DeviceState;

  const set: SetDeviceState = (update) => {
    const partial = typeof update === "function" ? update(state) : update;
    Object.assign(state, partial);
  };

  const get: GetDeviceState = () => state;

  const { lock, unlock, reset } = createLockActions(set, get);

  state = {
    isLocked: true,
    ephemeralPublicKey: null,
    ephemeralPublicKeyBytes: null,
    ephemeralPublicKeyFlag: null,
    ephemeralKeyPairSecretKey: { iv: "i", data: "d", salt: "s" },
    networkData: {},
    loading: false,
    error: null,
    initialize: stubAsync,
    initializeForChain: stubAsync,
    rotateEphemeralKey: stubAsync,
    getZkProof: async () => ({ error: "stub" }),
    lock,
    unlock,
    reset,
    getMaxEpoch: () => null,
    getMaxEpochTimestampMs: () => null,
    getNonce: () => null,
    getJwtRandomness: () => null,
  };

  return { state, lock, unlock, reset };
}

describe("createLockActions", () => {
  it("unlock (web path) unlocks without public key when vault returns null", async () => {
    vi.clearAllMocks();
    vi.mocked(vaultService.ephKeyService.hasKeypair).mockResolvedValue(true);
    vi.mocked(vaultService.ephKeyService.unlockVault).mockResolvedValue(null);

    const { unlock, state } = buildLockHarness();

    await unlock("123456");

    expect(vaultService.ephKeyService.unlockVault).toHaveBeenCalledWith(
      null,
      "123456",
    );
    expect(state.isLocked).toBe(false);
    expect(state.error).toBeNull();
    expect(state.ephemeralPublicKey).toBeNull();
  });

  it("reset restores initial network data map", () => {
    const { reset, state } = buildLockHarness();
    state.networkData = {
      [SUI_DEVNET_CHAIN]: {
        nonce: "x",
        maxEpoch: "1",
        maxEpochTimestampMs: 1,
        jwtRandomness: "y",
      },
    };

    reset();

    expect(state.networkData).toEqual(createInitialNetworkData());
    expect(state.isLocked).toBe(true);
    expect(state.ephemeralKeyPairSecretKey).toBeNull();
  });
});
