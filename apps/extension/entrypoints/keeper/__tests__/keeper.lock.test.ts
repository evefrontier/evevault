import { KeeperMessageTypes } from "@evevault/shared";
import type { ZkProofResponse } from "@evevault/shared/types";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { SuiChain } from "@mysten/wallet-standard";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Since the keeper uses chrome.runtime.onMessage.addListener, we need to simulate
// the message handling behavior

describe("Keeper LOCK message handler", () => {
  let mockEphemeralKey: Ed25519Keypair | null;
  let mockVaultUnlocked: boolean;
  let mockVaultUnlockExpiry: number | null;
  let mockZkProofs: Record<SuiChain, ZkProofResponse | null>;
  let mockSendResponse: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Initialize mock state
    mockEphemeralKey = Ed25519Keypair.generate();
    mockVaultUnlocked = true;
    mockVaultUnlockExpiry = Date.now() + 10 * 60 * 1000;
    mockZkProofs = {
      "sui:devnet": { data: undefined, error: undefined } as ZkProofResponse,
      "sui:testnet": { data: undefined, error: undefined } as ZkProofResponse,
      "sui:mainnet": { data: undefined, error: undefined } as ZkProofResponse,
      "sui:localnet": { data: undefined, error: undefined } as ZkProofResponse,
    };
    mockSendResponse = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Simulate LOCK message handler logic
  const simulateLockHandler = (message: { target?: string; type: string }) => {
    if (message.target !== "KEEPER") {
      return false;
    }

    if (message.type === KeeperMessageTypes.CLEAR_EPHKEY) {
      // Lock vault, clear ephkey and zkProofs
      mockEphemeralKey = null;
      mockVaultUnlocked = false;
      mockVaultUnlockExpiry = null;
      mockZkProofs = {
        "sui:devnet": null,
        "sui:testnet": null,
        "sui:localnet": null,
        "sui:mainnet": null,
      };
      (mockSendResponse as (response?: unknown) => void)({ ok: true });
      return false;
    }

    return false;
  };

  it("clears ephemeralKey when LOCK message is received", () => {
    expect(mockEphemeralKey).not.toBeNull();

    simulateLockHandler({
      target: "KEEPER",
      type: KeeperMessageTypes.CLEAR_EPHKEY,
    });

    expect(mockEphemeralKey).toBeNull();
    expect(mockSendResponse).toHaveBeenCalledWith({ ok: true });
  });

  it("sets _vaultUnlocked to false when LOCK message is received", () => {
    expect(mockVaultUnlocked).toBe(true);

    simulateLockHandler({
      target: "KEEPER",
      type: KeeperMessageTypes.CLEAR_EPHKEY,
    });

    expect(mockVaultUnlocked).toBe(false);
  });

  it("sets _vaultUnlockExpiry to null when LOCK message is received", () => {
    expect(mockVaultUnlockExpiry).not.toBeNull();

    simulateLockHandler({
      target: "KEEPER",
      type: KeeperMessageTypes.CLEAR_EPHKEY,
    });

    expect(mockVaultUnlockExpiry).toBeNull();
  });

  it("clears all chain zkProofs when LOCK message is received", () => {
    expect(mockZkProofs["sui:devnet"]).not.toBeNull();
    expect(mockZkProofs["sui:testnet"]).not.toBeNull();
    expect(mockZkProofs["sui:mainnet"]).not.toBeNull();
    expect(mockZkProofs["sui:localnet"]).not.toBeNull();

    simulateLockHandler({
      target: "KEEPER",
      type: KeeperMessageTypes.CLEAR_EPHKEY,
    });

    expect(mockZkProofs["sui:devnet"]).toBeNull();
    expect(mockZkProofs["sui:testnet"]).toBeNull();
    expect(mockZkProofs["sui:mainnet"]).toBeNull();
    expect(mockZkProofs["sui:localnet"]).toBeNull();
  });

  it("sends { ok: true } response when LOCK succeeds", () => {
    simulateLockHandler({
      target: "KEEPER",
      type: KeeperMessageTypes.CLEAR_EPHKEY,
    });

    expect(mockSendResponse).toHaveBeenCalledTimes(1);
    expect(mockSendResponse).toHaveBeenCalledWith({ ok: true });
  });

  it("does not process LOCK message if target is not KEEPER", () => {
    const originalKey = mockEphemeralKey;

    simulateLockHandler({
      target: "OTHER",
      type: KeeperMessageTypes.CLEAR_EPHKEY,
    });

    expect(mockEphemeralKey).toBe(originalKey);
    expect(mockSendResponse).not.toHaveBeenCalled();
  });

  it("clears all state in a single operation", () => {
    simulateLockHandler({
      target: "KEEPER",
      type: KeeperMessageTypes.CLEAR_EPHKEY,
    });

    expect(mockEphemeralKey).toBeNull();
    expect(mockVaultUnlocked).toBe(false);
    expect(mockVaultUnlockExpiry).toBeNull();
    expect(mockZkProofs["sui:devnet"]).toBeNull();
    expect(mockZkProofs["sui:testnet"]).toBeNull();
    expect(mockZkProofs["sui:mainnet"]).toBeNull();
    expect(mockZkProofs["sui:localnet"]).toBeNull();
  });
});
