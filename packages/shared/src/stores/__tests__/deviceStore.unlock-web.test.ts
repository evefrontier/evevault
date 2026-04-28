import { Ed25519PublicKey } from "@mysten/sui/keypairs/ed25519";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as vaultService from "@/services/vaultService";

vi.mock("@/services/vaultService", () => ({
  ephKeyService: {
    initialize: vi.fn(),
    hasKeypair: vi.fn(),
    unlockVault: vi.fn(),
    createEphemeralKeyPair: vi.fn(),
    rotateEphemeralKeyPair: vi.fn(),
    getEphemeralPublicKey: vi.fn(),
    lock: vi.fn(),
    isUnlocked: vi.fn(() => false),
  },
  zkProofService: {
    getZkProof: vi.fn(),
    setZkProof: vi.fn(),
  },
}));

import { useDeviceStore } from "@/stores/deviceStore";

describe("deviceStore.unlock (web / jsdom path)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDeviceStore.setState({
      isLocked: true,
      ephemeralPublicKey: null,
      ephemeralPublicKeyBytes: null,
      ephemeralPublicKeyFlag: null,
      ephemeralKeyPairSecretKey: null,
      networkData: {},
      loading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sets error when PIN is empty", async () => {
    await useDeviceStore.getState().unlock("");
    expect(useDeviceStore.getState().error).toBe("PIN is required");
    expect(useDeviceStore.getState().isLocked).toBe(true);
  });

  it("sets error when PIN is only whitespace", async () => {
    await useDeviceStore.getState().unlock("   ");
    expect(useDeviceStore.getState().error).toBe("PIN is required");
  });

  it("sets error when no keypair is available", async () => {
    vi.mocked(vaultService.ephKeyService.hasKeypair).mockResolvedValue(false);
    await useDeviceStore.getState().unlock("123456");
    expect(useDeviceStore.getState().error).toBe("No keypair available");
    expect(useDeviceStore.getState().isLocked).toBe(true);
    expect(vaultService.ephKeyService.unlockVault).not.toHaveBeenCalled();
  });

  it("unlocks and persists public key bytes when vault succeeds", async () => {
    const publicKey = new Ed25519PublicKey(new Uint8Array(32).fill(3));
    vi.mocked(vaultService.ephKeyService.hasKeypair).mockResolvedValue(true);
    vi.mocked(vaultService.ephKeyService.unlockVault).mockResolvedValue(
      publicKey,
    );

    await useDeviceStore.getState().unlock("123456");

    expect(vaultService.ephKeyService.unlockVault).toHaveBeenCalledWith(
      null,
      "123456",
    );
    const s = useDeviceStore.getState();
    expect(s.isLocked).toBe(false);
    expect(s.error).toBeNull();
    expect(s.ephemeralPublicKey?.toRawBytes()).toEqual(publicKey.toRawBytes());
    expect(s.ephemeralPublicKeyFlag).toBe(publicKey.flag());
  });

  it("sets error message when unlockVault throws", async () => {
    vi.mocked(vaultService.ephKeyService.hasKeypair).mockResolvedValue(true);
    vi.mocked(vaultService.ephKeyService.unlockVault).mockRejectedValue(
      new Error("decrypt failed"),
    );

    await useDeviceStore.getState().unlock("123456");

    expect(useDeviceStore.getState().error).toBe("decrypt failed");
  });
});
