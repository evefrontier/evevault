import { Ed25519PublicKey } from "@mysten/sui/keypairs/ed25519";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("#/utils/environment", () => ({
  isBrowser: () => true,
  isExtension: () => false,
  isWeb: () => false,
}));

vi.mock("#/services/vaultService", () => ({
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

import * as vaultService from "#/services/vaultService";
import { useDeviceStore } from "#/stores/deviceStore";

describe("deviceStore.unlock (extension path, isWeb false)", () => {
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

  it("sets error when no stored secret key", async () => {
    await useDeviceStore.getState().unlock("123456");
    expect(useDeviceStore.getState().error).toBe("No secret key available");
    expect(useDeviceStore.getState().isLocked).toBe(true);
    expect(vaultService.ephKeyService.unlockVault).not.toHaveBeenCalled();
  });

  it("calls unlockVault with stored key and PIN", async () => {
    const stored = { iv: "iv", data: "data", salt: "salt" };
    const publicKey = new Ed25519PublicKey(new Uint8Array(32).fill(5));
    useDeviceStore.setState({ ephemeralKeyPairSecretKey: stored });
    vi.mocked(vaultService.ephKeyService.unlockVault).mockResolvedValue(
      publicKey,
    );

    await useDeviceStore.getState().unlock("654321");

    expect(vaultService.ephKeyService.unlockVault).toHaveBeenCalledWith(
      stored,
      "654321",
    );
    const s = useDeviceStore.getState();
    expect(s.isLocked).toBe(false);
    expect(s.error).toBeNull();
    expect(s.ephemeralPublicKey?.toRawBytes()).toEqual(publicKey.toRawBytes());
  });
});
