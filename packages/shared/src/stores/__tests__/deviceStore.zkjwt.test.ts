import { Ed25519PublicKey } from "@mysten/sui/keypairs/ed25519";
import { SUI_DEVNET_CHAIN } from "@mysten/wallet-standard";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNetworkStore } from "@/stores/networkStore";

const fetchZkProofMock = vi.fn();
const vendJwtMock = vi.fn();
const getZkLoginJwtForNetworkMock = vi.fn();
const storeZkLoginJwtForNetworkMock = vi.fn();
const hasJwtMock = vi.fn();
const getJwtMock = vi.fn();
const getZkProofFromKeeperMock = vi.fn();
const setZkProofInKeeperMock = vi.fn();

vi.mock("@/wallet/zkProof", () => ({
  fetchZkProof: (...args: unknown[]) => fetchZkProofMock(...args),
}));

vi.mock("@/auth/vendToken", () => ({
  vendJwt: (...args: unknown[]) => vendJwtMock(...args),
}));

vi.mock("@/auth/storageService", () => ({
  getZkLoginJwtForNetwork: (...args: unknown[]) =>
    getZkLoginJwtForNetworkMock(...args),
  storeZkLoginJwtForNetwork: (...args: unknown[]) =>
    storeZkLoginJwtForNetworkMock(...args),
  hasJwt: (...args: unknown[]) => hasJwtMock(...args),
  getJwt: (...args: unknown[]) => getJwtMock(...args),
}));

vi.mock("@/services/vaultService", () => ({
  ephKeyService: {
    initialize: vi.fn(),
    hasKeypair: vi.fn(),
    unlockVault: vi.fn(),
    createEphemeralKeyPair: vi.fn(),
    getEphemeralPublicKey: vi.fn(),
    lock: vi.fn(),
    isUnlocked: vi.fn(() => false),
  },
  zkProofService: {
    getZkProof: (...args: unknown[]) => getZkProofFromKeeperMock(...args),
    setZkProof: (...args: unknown[]) => setZkProofInKeeperMock(...args),
  },
}));

vi.mock("@/auth", () => ({
  useAuthStore: {
    getState: () => ({
      user: { id_token: "header.payload.signature" },
    }),
  },
}));

import { useDeviceStore } from "@/stores/deviceStore";

function makeJwtWithExp(exp: number): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "none", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
  return `${header}.${payload}.signature`;
}

describe("deviceStore.getZkProof with expired stored zkLogin JWT", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useNetworkStore.setState({ chain: SUI_DEVNET_CHAIN });

    const publicKey = new Ed25519PublicKey(new Uint8Array(32).fill(1));
    useDeviceStore.setState({
      isLocked: false,
      ephemeralPublicKey: publicKey,
      ephemeralPublicKeyBytes: Array.from(publicKey.toRawBytes()),
      ephemeralPublicKeyFlag: publicKey.flag(),
      networkData: {
        [SUI_DEVNET_CHAIN]: {
          nonce: "device-nonce",
          maxEpoch: "123",
          maxEpochTimestampMs: Date.now() + 60_000,
          jwtRandomness: "randomness",
        },
      },
      error: null,
      loading: false,
    });

    hasJwtMock.mockResolvedValue(true);
    getJwtMock.mockResolvedValue({
      id_token: "primary.jwt.token",
      access_token: "primary.jwt.token",
      token_type: "Bearer",
      scope: "openid profile email",
      expires_in: 3600,
    });
    getZkProofFromKeeperMock.mockResolvedValue(null);
    setZkProofInKeeperMock.mockResolvedValue(undefined);

    const expiredJwt = makeJwtWithExp(Math.floor(Date.now() / 1000) - 10);
    getZkLoginJwtForNetworkMock.mockResolvedValue({
      id_token: expiredJwt,
      expires_at: Math.floor(Date.now() / 1000) - 10,
    });

    const freshVendedJwt = makeJwtWithExp(Math.floor(Date.now() / 1000) + 3600);
    vendJwtMock.mockResolvedValue(freshVendedJwt);
    fetchZkProofMock.mockResolvedValue({
      data: {} as never,
      error: undefined,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("re-vends from primary JWT and uses new token for proof", async () => {
    await useDeviceStore.getState().getZkProof();

    expect(vendJwtMock).toHaveBeenCalledTimes(1);
    expect(vendJwtMock).toHaveBeenCalledWith("primary.jwt.token", {
      nonce: "device-nonce",
    });

    const freshToken = vendJwtMock.mock.results[0]?.value;
    await expect(freshToken).resolves.toBeTypeOf("string");
    const resolvedToken = await freshToken;

    expect(fetchZkProofMock).toHaveBeenCalledTimes(1);
    expect(fetchZkProofMock).toHaveBeenCalledWith(
      expect.objectContaining({
        idToken: resolvedToken,
      }),
    );
  });
});
