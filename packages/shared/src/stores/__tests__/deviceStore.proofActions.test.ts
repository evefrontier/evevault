import { Ed25519PublicKey } from "@mysten/sui/keypairs/ed25519";
import { SUI_DEVNET_CHAIN } from "@mysten/wallet-standard";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProofActions } from "@/stores/deviceStore/actions/proofActions";
import type {
  GetDeviceState,
  SetDeviceState,
} from "@/stores/deviceStore/actions/types";
import type { DeviceState } from "@/types";

const mockAuthGetState = vi.hoisted(() => vi.fn());
const hasJwtMock = vi.hoisted(() => vi.fn());
const getJwtMock = vi.hoisted(() => vi.fn());
const getZkProofFromKeeperMock = vi.hoisted(() => vi.fn());
const setZkProofMock = vi.hoisted(() => vi.fn());
const fetchZkProofMock = vi.hoisted(() => vi.fn());
const resolveVendedMock = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({
  useAuthStore: {
    getState: mockAuthGetState,
  },
}));

vi.mock("@/auth/storageService", () => ({
  hasJwt: (...args: unknown[]) => hasJwtMock(...args),
  getJwt: (...args: unknown[]) => getJwtMock(...args),
}));

vi.mock("@/services/vaultService", () => ({
  ephKeyService: {
    isUnlocked: vi.fn(() => false),
    lock: vi.fn(),
    initialize: vi.fn(),
    hasKeypair: vi.fn(),
    unlockVault: vi.fn(),
    createEphemeralKeyPair: vi.fn(),
    getEphemeralPublicKey: vi.fn(),
  },
  zkProofService: {
    getZkProof: (...args: unknown[]) => getZkProofFromKeeperMock(...args),
    setZkProof: (...args: unknown[]) => setZkProofMock(...args),
    clear: vi.fn(),
  },
}));

vi.mock("@/wallet/zkProof", () => ({
  fetchZkProof: (...args: unknown[]) => fetchZkProofMock(...args),
}));

vi.mock("@/stores/deviceStore/zkJwt", () => ({
  resolveVendedIdTokenForZkProof: (...args: unknown[]) =>
    resolveVendedMock(...args),
}));

vi.mock("@/stores/networkStore", () => ({
  useNetworkStore: {
    getState: () => ({ chain: SUI_DEVNET_CHAIN }),
  },
}));

function stubAsync() {
  return Promise.resolve();
}

function buildProofHarness(overrides: Partial<DeviceState> = {}) {
  let state: DeviceState;

  const set: SetDeviceState = (update) => {
    const partial = typeof update === "function" ? update(state) : update;
    Object.assign(state, partial);
  };

  const get: GetDeviceState = () => state;

  const { getZkProof } = createProofActions(set, get);

  const chain = SUI_DEVNET_CHAIN;
  const pk = new Ed25519PublicKey(new Uint8Array(32).fill(4));

  state = {
    isLocked: false,
    ephemeralPublicKey: pk,
    ephemeralPublicKeyBytes: null,
    ephemeralPublicKeyFlag: null,
    ephemeralKeyPairSecretKey: null,
    networkData: {
      [SUI_DEVNET_CHAIN]: {
        nonce: "nonce-1",
        maxEpoch: "10",
        maxEpochTimestampMs: Date.now() + 60_000,
        jwtRandomness: "random",
      },
    },
    loading: false,
    error: null,
    initialize: stubAsync,
    initializeForChain: stubAsync,
    rotateEphemeralKey: stubAsync,
    lock: stubAsync,
    unlock: stubAsync,
    reset: () => {},
    getZkProof,
    getMaxEpoch: (c) => state.networkData[c ?? chain]?.maxEpoch ?? null,
    getMaxEpochTimestampMs: (c) =>
      state.networkData[c ?? chain]?.maxEpochTimestampMs ?? null,
    getNonce: (c) => state.networkData[c ?? chain]?.nonce ?? null,
    getJwtRandomness: (c) =>
      state.networkData[c ?? chain]?.jwtRandomness ?? null,
    ...overrides,
  };

  return { state, getZkProof };
}

describe("createProofActions.getZkProof", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getZkProofFromKeeperMock.mockResolvedValue(null);
    setZkProofMock.mockResolvedValue(undefined);
    mockAuthGetState.mockReturnValue({
      user: { id_token: "primary.id.token" },
    } as never);
    hasJwtMock.mockResolvedValue(true);
    getJwtMock.mockResolvedValue({
      id_token: "stored.primary",
    } as never);
    resolveVendedMock.mockResolvedValue("vended.id.token");
    fetchZkProofMock.mockResolvedValue({
      data: { inputs: "mock" } as never,
      error: undefined,
    });
  });

  it("returns error when user is not authenticated", async () => {
    mockAuthGetState.mockReturnValue({ user: null } as never);
    const { getZkProof, state } = buildProofHarness({
      networkData: {
        [SUI_DEVNET_CHAIN]: {
          nonce: "n",
          maxEpoch: "1",
          maxEpochTimestampMs: null,
          jwtRandomness: "r",
        },
      },
    });

    const result = await getZkProof();

    expect(result).toEqual({ error: "User not authenticated" });
    expect(state.error).toBe("User not authenticated");
  });

  it("returns error when ephemeral public key is missing", async () => {
    const { getZkProof, state } = buildProofHarness({
      ephemeralPublicKey: null,
      networkData: {
        [SUI_DEVNET_CHAIN]: {
          nonce: "n",
          maxEpoch: "1",
          maxEpochTimestampMs: null,
          jwtRandomness: "r",
        },
      },
    });

    const result = await getZkProof();

    expect(result).toEqual({ error: "Ephemeral public key not found" });
    expect(state.error).toBe("Ephemeral public key not found");
  });

  it("returns error when no JWT for network", async () => {
    getJwtMock.mockResolvedValue(null);
    const { getZkProof, state } = buildProofHarness({
      networkData: {
        [SUI_DEVNET_CHAIN]: {
          nonce: "n",
          maxEpoch: "1",
          maxEpochTimestampMs: null,
          jwtRandomness: "r",
        },
      },
    });

    const result = await getZkProof();

    expect(result).toEqual({
      error: "No valid JWT found for devnet. Please sign in again.",
    });
    expect(state.error).toBe(
      "No valid JWT found for devnet. Please sign in again.",
    );
  });

  it("returns error when JWT randomness is missing", async () => {
    const { getZkProof, state } = buildProofHarness({
      networkData: {
        [SUI_DEVNET_CHAIN]: {
          nonce: "n",
          maxEpoch: "1",
          maxEpochTimestampMs: null,
          jwtRandomness: null,
        },
      },
    });

    const result = await getZkProof();

    expect(result).toEqual({
      error: "JWT randomness not found for devnet. Please sign in again.",
    });
    expect(state.error).toBe(
      "JWT randomness not found for devnet. Please sign in again.",
    );
  });

  it("persists proof and returns response when fetchZkProof succeeds", async () => {
    const { getZkProof } = buildProofHarness();

    const result = await getZkProof();

    expect(resolveVendedMock).toHaveBeenCalled();
    expect(fetchZkProofMock).toHaveBeenCalledWith(
      expect.objectContaining({
        idToken: "vended.id.token",
        jwtRandomness: "random",
        maxEpoch: "10",
      }),
    );
    expect(setZkProofMock).toHaveBeenCalledWith(
      SUI_DEVNET_CHAIN,
      expect.objectContaining({ data: { inputs: "mock" } }),
    );
    expect(result).toEqual(
      expect.objectContaining({ data: { inputs: "mock" } }),
    );
  });

  it("rotates the eph key before generating proof when epoch is expired", async () => {
    const rotateEphemeralKey = vi.fn().mockImplementation(async () => {
      state.networkData[SUI_DEVNET_CHAIN] = {
        nonce: "rotated-nonce",
        maxEpoch: "22",
        maxEpochTimestampMs: Date.now() + 60_000,
        jwtRandomness: "rotated-random",
      };
    });
    const { getZkProof, state } = buildProofHarness({
      rotateEphemeralKey,
      networkData: {
        [SUI_DEVNET_CHAIN]: {
          nonce: "stale",
          maxEpoch: "10",
          maxEpochTimestampMs: Date.now() - 1_000,
          jwtRandomness: "old-random",
        },
      },
    });

    await getZkProof();

    expect(rotateEphemeralKey).toHaveBeenCalledTimes(1);
    expect(resolveVendedMock).toHaveBeenCalledWith(
      SUI_DEVNET_CHAIN,
      expect.anything(),
      "rotated-nonce",
      expect.any(Function),
    );
    expect(fetchZkProofMock).toHaveBeenCalledWith(
      expect.objectContaining({
        jwtRandomness: "rotated-random",
        maxEpoch: "22",
      }),
    );
  });

  it("reuses keeper proof when max epoch not expired and keeper returns proof", async () => {
    const cached = {
      data: { cached: true } as never,
      error: undefined as undefined,
    };
    getZkProofFromKeeperMock.mockResolvedValue(cached);

    const { getZkProof } = buildProofHarness();

    const result = await getZkProof();

    expect(result).toBe(cached);
    expect(fetchZkProofMock).not.toHaveBeenCalled();
  });
});
