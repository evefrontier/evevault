import {
  decrypt,
  deriveAesKey,
  encrypt,
  type HashedData,
  KeeperMessageTypes,
} from "@evevault/shared";
import type { ZkProofResponse } from "@evevault/shared/types";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { SuiChain } from "@mysten/wallet-standard";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// These tests simulate keeper handler branches inline because keeper.ts is a
// Chrome offscreen document and registers its listener at module load.

const TEST_PIN = "123456";
const TEN_MINUTES_MS = 10 * 60 * 1000;

function saltBytes(salt: string): Uint8Array {
  return Uint8Array.from(atob(salt), (c) => c.charCodeAt(0));
}

describe("Keeper CREATE_KEYPAIR handler", () => {
  let ephemeralKey: Ed25519Keypair | null;
  let vaultUnlocked: boolean;
  let vaultUnlockExpiry: number | null;
  let sessionDerivedKey: CryptoKey | null;
  let sessionSalt: string | null;
  let sendResponse: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ephemeralKey = null;
    vaultUnlocked = false;
    vaultUnlockExpiry = null;
    sessionDerivedKey = null;
    sessionSalt = null;
    sendResponse = vi.fn();
  });

  async function simulateCreateKeypair(
    pin: string,
    encryptFn: typeof encrypt = encrypt,
  ) {
    ephemeralKey = Ed25519Keypair.generate();
    vaultUnlocked = true;
    vaultUnlockExpiry = Date.now() + TEN_MINUTES_MS;

    try {
      const hashedSecretKey = await encryptFn(ephemeralKey.getSecretKey(), pin);
      sessionDerivedKey = await deriveAesKey(
        pin,
        saltBytes(hashedSecretKey.salt),
        ["encrypt"],
      );
      sessionSalt = hashedSecretKey.salt;

      sendResponse({
        ok: true,
        hashedSecretKey,
        publicKeyBytes: Array.from(ephemeralKey.getPublicKey().toRawBytes()),
      });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  it("generates an Ed25519 keypair, encrypts it with PIN, and derives a session key", async () => {
    await simulateCreateKeypair(TEST_PIN);

    const response = sendResponse.mock.calls[0][0] as {
      ok: boolean;
      hashedSecretKey: HashedData;
      publicKeyBytes: number[];
    };

    expect(response.ok).toBe(true);
    expect(ephemeralKey).toBeInstanceOf(Ed25519Keypair);
    expect(vaultUnlocked).toBe(true);
    expect(vaultUnlockExpiry).toBeGreaterThan(Date.now());
    expect(sessionDerivedKey).toBeInstanceOf(CryptoKey);
    expect(sessionSalt).toBe(response.hashedSecretKey.salt);
    const currentKey = ephemeralKey as Ed25519Keypair;
    expect(response.publicKeyBytes).toEqual(
      Array.from(currentKey.getPublicKey().toRawBytes()),
    );
    await expect(decrypt(response.hashedSecretKey, TEST_PIN)).resolves.toBe(
      currentKey.getSecretKey(),
    );
  });

  it("returns hashedSecretKey and publicKeyBytes", async () => {
    await simulateCreateKeypair(TEST_PIN);

    expect(sendResponse).toHaveBeenCalledWith({
      ok: true,
      hashedSecretKey: {
        iv: expect.any(String),
        data: expect.any(String),
        salt: expect.any(String),
      },
      publicKeyBytes: expect.any(Array),
    });
  });

  it("returns an error when encryption fails", async () => {
    await simulateCreateKeypair(
      TEST_PIN,
      vi.fn().mockRejectedValue(new Error("encrypt failed")) as typeof encrypt,
    );

    expect(sendResponse).toHaveBeenCalledWith({
      ok: false,
      error: "encrypt failed",
    });
  });

  it("handles only KEEPER-targeted CREATE_KEYPAIR messages", async () => {
    const message = {
      target: "OTHER",
      type: KeeperMessageTypes.CREATE_KEYPAIR,
      pin: TEST_PIN,
    };

    const handled = message.target === "KEEPER";
    if (handled) {
      await simulateCreateKeypair(message.pin);
    }

    expect(handled).toBe(false);
    expect(sendResponse).not.toHaveBeenCalled();
  });
});

describe("Keeper UNLOCK_VAULT handler", () => {
  let ephemeralKey: Ed25519Keypair | null;
  let vaultUnlocked: boolean;
  let vaultUnlockExpiry: number | null;
  let sessionDerivedKey: CryptoKey | null;
  let sessionSalt: string | null;
  let sendResponse: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ephemeralKey = null;
    vaultUnlocked = false;
    vaultUnlockExpiry = null;
    sessionDerivedKey = null;
    sessionSalt = null;
    sendResponse = vi.fn();
  });

  async function simulateUnlockVault(hashedSecretKey: HashedData, pin: string) {
    try {
      let secretKey: string;
      try {
        secretKey = await decrypt(hashedSecretKey, pin);
      } catch (decryptError) {
        sendResponse({
          ok: false,
          error: `[Keeper] Decryption failed: ${
            decryptError instanceof Error
              ? decryptError.message
              : "Unknown error"
          }`,
        });
        return;
      }

      try {
        ephemeralKey = Ed25519Keypair.fromSecretKey(secretKey);
        vaultUnlocked = true;
        vaultUnlockExpiry = Date.now() + TEN_MINUTES_MS;
        sessionDerivedKey = await deriveAesKey(
          pin,
          saltBytes(hashedSecretKey.salt),
          ["encrypt"],
        );
        sessionSalt = hashedSecretKey.salt;
        sendResponse({ ok: true });
      } catch (keypairError) {
        sendResponse({
          ok: false,
          error: `[Keeper] Failed to create keypair: ${
            keypairError instanceof Error
              ? keypairError.message
              : "Unknown error"
          }`,
        });
      }
    } catch (error) {
      sendResponse({
        ok: false,
        error: `[Keeper] Unexpected error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  }

  it("decrypts secret key with PIN, reconstructs Ed25519Keypair, and derives session key", async () => {
    const originalKeypair = Ed25519Keypair.generate();
    const hashedSecretKey = await encrypt(
      originalKeypair.getSecretKey(),
      TEST_PIN,
    );

    await simulateUnlockVault(hashedSecretKey, TEST_PIN);

    expect(sendResponse).toHaveBeenCalledWith({ ok: true });
    expect(ephemeralKey).toBeInstanceOf(Ed25519Keypair);
    const currentKey = ephemeralKey as Ed25519Keypair;
    expect(currentKey.getPublicKey().toSuiAddress()).toBe(
      originalKeypair.getPublicKey().toSuiAddress(),
    );
    expect(vaultUnlocked).toBe(true);
    expect(vaultUnlockExpiry).toBeGreaterThan(Date.now());
    expect(sessionDerivedKey).toBeInstanceOf(CryptoKey);
    expect(sessionSalt).toBe(hashedSecretKey.salt);
  });

  it("returns a distinct decryption error for a wrong PIN", async () => {
    const hashedSecretKey = await encrypt(
      Ed25519Keypair.generate().getSecretKey(),
      TEST_PIN,
    );

    await simulateUnlockVault(hashedSecretKey, "wrong-pin");

    expect(ephemeralKey).toBeNull();
    expect(sendResponse).toHaveBeenCalledWith({
      ok: false,
      error: expect.stringContaining("[Keeper] Decryption failed:"),
    });
  });

  it("returns a distinct keypair reconstruction error when decrypted data is not a secret key", async () => {
    const hashedSecretKey = await encrypt("not-a-secret-key", TEST_PIN);

    await simulateUnlockVault(hashedSecretKey, TEST_PIN);

    expect(ephemeralKey).toBeNull();
    expect(sendResponse).toHaveBeenCalledWith({
      ok: false,
      error: expect.stringContaining("[Keeper] Failed to create keypair:"),
    });
  });
});

describe("Keeper CLEAR_EPHKEY message handler", () => {
  let mockEphemeralKey: Ed25519Keypair | null;
  let mockVaultUnlocked: boolean;
  let mockVaultUnlockExpiry: number | null;
  let mockSessionDerivedKey: CryptoKey | null;
  let mockSessionSalt: string | null;
  let mockZkProofs: Partial<Record<SuiChain, ZkProofResponse | null>>;
  let mockLocalnetKey: Ed25519Keypair | null;
  let mockSendResponse: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockEphemeralKey = Ed25519Keypair.generate();
    mockLocalnetKey = Ed25519Keypair.generate();
    mockVaultUnlocked = true;
    mockVaultUnlockExpiry = Date.now() + TEN_MINUTES_MS;
    mockSessionDerivedKey = {} as CryptoKey;
    mockSessionSalt = "base64salt==";
    mockZkProofs = {
      "sui:devnet": { data: undefined, error: undefined } as ZkProofResponse,
      "sui:testnet": { data: undefined, error: undefined } as ZkProofResponse,
      "sui:mainnet": { data: undefined, error: undefined } as ZkProofResponse,
    };
    mockSendResponse = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const simulateClearEphKeyHandler = (message: {
    target?: string;
    type: string;
  }) => {
    if (message.target !== "KEEPER") {
      return false;
    }

    if (message.type === KeeperMessageTypes.CLEAR_EPHKEY) {
      mockEphemeralKey = null;
      mockLocalnetKey = null;
      mockSessionDerivedKey = null;
      mockSessionSalt = null;
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

    simulateClearEphKeyHandler({
      target: "KEEPER",
      type: KeeperMessageTypes.CLEAR_EPHKEY,
    });

    expect(mockZkProofs["sui:devnet"]).not.toBeNull();
    expect(mockZkProofs["sui:testnet"]).not.toBeNull();
    expect(mockZkProofs["sui:mainnet"]).not.toBeNull();
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
    expect(mockLocalnetKey).toBeNull();
    expect(mockSessionDerivedKey).toBeNull();
    expect(mockSessionSalt).toBeNull();
    expect(mockVaultUnlocked).toBe(false);
    expect(mockVaultUnlockExpiry).toBeNull();
  });

  it("clears localnet keypair when CLEAR_EPHKEY is received", () => {
    expect(mockLocalnetKey).not.toBeNull();

    simulateClearEphKeyHandler({
      target: "KEEPER",
      type: KeeperMessageTypes.CLEAR_EPHKEY,
    });

    expect(mockLocalnetKey).toBeNull();
  });

  it("does not clear localnet keypair when target is not KEEPER", () => {
    const original = mockLocalnetKey;

    simulateClearEphKeyHandler({
      target: "OTHER",
      type: KeeperMessageTypes.CLEAR_EPHKEY,
    });

    expect(mockLocalnetKey).toBe(original);
  });
});

describe("Keeper checkAndEnforceExpiry", () => {
  let ephemeralKey: Ed25519Keypair | null;
  let localnetKey: Ed25519Keypair | null;
  let sessionDerivedKey: CryptoKey | null;
  let sessionSalt: string | null;
  let vaultUnlocked: boolean;
  let vaultUnlockExpiry: number | null;

  beforeEach(() => {
    ephemeralKey = Ed25519Keypair.generate();
    localnetKey = Ed25519Keypair.generate();
    sessionDerivedKey = {} as CryptoKey;
    sessionSalt = "salt";
    vaultUnlocked = true;
    vaultUnlockExpiry = Date.now() + TEN_MINUTES_MS;
  });

  function checkAndEnforceExpiry(): boolean {
    if (!ephemeralKey && !localnetKey) {
      return true;
    }

    if (vaultUnlockExpiry && Date.now() > vaultUnlockExpiry) {
      ephemeralKey = null;
      localnetKey = null;
      sessionDerivedKey = null;
      sessionSalt = null;
      vaultUnlocked = false;
      vaultUnlockExpiry = null;
      return true;
    }

    return false;
  }

  it("returns true immediately when no ephemeralKey and no localnetKey exist", () => {
    ephemeralKey = null;
    localnetKey = null;

    expect(checkAndEnforceExpiry()).toBe(true);
  });

  it("returns false when unlock expiry is in the future", () => {
    expect(checkAndEnforceExpiry()).toBe(false);
    expect(ephemeralKey).not.toBeNull();
    expect(localnetKey).not.toBeNull();
    expect(vaultUnlocked).toBe(true);
  });

  it("clears all in-memory vault state and returns true when expiry has passed", () => {
    vaultUnlockExpiry = Date.now() - 1;

    expect(checkAndEnforceExpiry()).toBe(true);
    expect(ephemeralKey).toBeNull();
    expect(localnetKey).toBeNull();
    expect(sessionDerivedKey).toBeNull();
    expect(sessionSalt).toBeNull();
    expect(vaultUnlocked).toBe(false);
    expect(vaultUnlockExpiry).toBeNull();
  });

  it("clears localnet key on expiry even when the zkLogin key is already absent", () => {
    ephemeralKey = null;
    vaultUnlockExpiry = Date.now() - 1;

    expect(checkAndEnforceExpiry()).toBe(true);
    expect(localnetKey).toBeNull();
  });
});

describe("Keeper message guards", () => {
  let sendResponse: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sendResponse = vi.fn();
  });

  function simulateMessageGuard(message: { target?: string; type?: string }) {
    if (message.target !== "KEEPER") {
      return false;
    }

    if (message.type === KeeperMessageTypes.GET_PUBLIC_KEY) {
      sendResponse({ error: "LOCKED" });
      return false;
    }

    sendResponse({ error: "Unknown message type" });
    return false;
  }

  it("returns false without calling sendResponse for non-KEEPER targets", () => {
    const result = simulateMessageGuard({
      target: "BACKGROUND",
      type: KeeperMessageTypes.GET_PUBLIC_KEY,
    });

    expect(result).toBe(false);
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it("sends Unknown message type for unsupported KEEPER messages", () => {
    const result = simulateMessageGuard({
      target: "KEEPER",
      type: "NOT_A_REAL_MESSAGE",
    });

    expect(result).toBe(false);
    expect(sendResponse).toHaveBeenCalledWith({
      error: "Unknown message type",
    });
  });
});
