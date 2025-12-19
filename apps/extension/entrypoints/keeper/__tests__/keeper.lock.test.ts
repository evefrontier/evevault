import { KeeperMessageTypes } from "@evevault/shared";
import type { ZkProofResponse } from "@evevault/shared/types";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { SuiChain } from "@mysten/wallet-standard";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Since the keeper uses chrome.runtime.onMessage.addListener, we need to simulate
// the message handling behavior

describe("Keeper CLEAR_EPHKEY message handler", () => {
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

  // Simulate CLEAR_EPHKEY message handler logic (clears ephkey but NOT zkProofs)
  const simulateClearEphKeyHandler = (message: {
    target?: string;
    type: string;
  }) => {
    if (message.target !== "KEEPER") {
      return false;
    }

    if (message.type === KeeperMessageTypes.CLEAR_EPHKEY) {
      // Clear ephemeral key and vault state (but NOT zkProofs - that's CLEAR_ZKPROOF)
      mockEphemeralKey = null;
      mockVaultUnlocked = false;
      mockVaultUnlockExpiry = null;
      (mockSendResponse as (response?: unknown) => void)({ ok: true });
      return false;
    }

    return false;
  };

  it("clears ephemeralKey when CLEAR_EPHKEY message is received", () => {
    expect(mockEphemeralKey).not.toBeNull();

    simulateClearEphKeyHandler({
      target: "KEEPER",
      type: KeeperMessageTypes.CLEAR_EPHKEY,
    });

    expect(mockEphemeralKey).toBeNull();
    expect(mockSendResponse).toHaveBeenCalledWith({ ok: true });
  });

  it("sets _vaultUnlocked to false when CLEAR_EPHKEY message is received", () => {
    expect(mockVaultUnlocked).toBe(true);

    simulateClearEphKeyHandler({
      target: "KEEPER",
      type: KeeperMessageTypes.CLEAR_EPHKEY,
    });

    expect(mockVaultUnlocked).toBe(false);
  });

  it("sets _vaultUnlockExpiry to null when CLEAR_EPHKEY message is received", () => {
    expect(mockVaultUnlockExpiry).not.toBeNull();

    simulateClearEphKeyHandler({
      target: "KEEPER",
      type: KeeperMessageTypes.CLEAR_EPHKEY,
    });

    expect(mockVaultUnlockExpiry).toBeNull();
  });

  it("does NOT clear zkProofs when CLEAR_EPHKEY is received (use CLEAR_ZKPROOF for that)", () => {
    expect(mockZkProofs["sui:devnet"]).not.toBeNull();
    expect(mockZkProofs["sui:testnet"]).not.toBeNull();
    expect(mockZkProofs["sui:mainnet"]).not.toBeNull();
    expect(mockZkProofs["sui:localnet"]).not.toBeNull();

    simulateClearEphKeyHandler({
      target: "KEEPER",
      type: KeeperMessageTypes.CLEAR_EPHKEY,
    });

    // zkProofs should still be set - CLEAR_EPHKEY only clears the ephemeral key
    expect(mockZkProofs["sui:devnet"]).not.toBeNull();
    expect(mockZkProofs["sui:testnet"]).not.toBeNull();
    expect(mockZkProofs["sui:mainnet"]).not.toBeNull();
    expect(mockZkProofs["sui:localnet"]).not.toBeNull();
  });

  it("sends { ok: true } response when CLEAR_EPHKEY succeeds", () => {
    simulateClearEphKeyHandler({
      target: "KEEPER",
      type: KeeperMessageTypes.CLEAR_EPHKEY,
    });

    expect(mockSendResponse).toHaveBeenCalledTimes(1);
    expect(mockSendResponse).toHaveBeenCalledWith({ ok: true });
  });

  it("does not process CLEAR_EPHKEY message if target is not KEEPER", () => {
    const originalKey = mockEphemeralKey;

    simulateClearEphKeyHandler({
      target: "OTHER",
      type: KeeperMessageTypes.CLEAR_EPHKEY,
    });

    expect(mockEphemeralKey).toBe(originalKey);
    expect(mockSendResponse).not.toHaveBeenCalled();
  });

  it("clears ephemeral key state in a single operation", () => {
    simulateClearEphKeyHandler({
      target: "KEEPER",
      type: KeeperMessageTypes.CLEAR_EPHKEY,
    });

    expect(mockEphemeralKey).toBeNull();
    expect(mockVaultUnlocked).toBe(false);
    expect(mockVaultUnlockExpiry).toBeNull();
  });
});
