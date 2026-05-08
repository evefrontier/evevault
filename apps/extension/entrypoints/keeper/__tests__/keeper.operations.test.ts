import {
  decrypt,
  deriveAesKey,
  encrypt,
  encryptWithKey,
  type HashedData,
  KeeperMessageTypes,
} from "@evevault/shared";
import type { ZkProofResponse } from "@evevault/shared/types";
import { SUI_PRIVATE_KEY_PREFIX } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import {
  SUI_DEVNET_CHAIN,
  SUI_MAINNET_CHAIN,
  SUI_TESTNET_CHAIN,
  type SuiChain,
} from "@mysten/wallet-standard";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// These tests simulate keeper handler branches inline because keeper.ts is a
// Chrome offscreen document and registers its listener at module load.

const TEST_PIN = "123456";
const TEN_MINUTES_MS = 10 * 60 * 1000;

function saltBytes(salt: string): Uint8Array {
  return Uint8Array.from(atob(salt), (c) => c.charCodeAt(0));
}

/** Random Ed25519 key material in `suiprivkey` form for keeper / vault simulations. */
function makeTestKey(): { keypair: Ed25519Keypair; bech32: string } {
  const keypair = Ed25519Keypair.generate();
  return { keypair, bech32: keypair.getSecretKey() };
}

async function makeSessionKey(pin: string, salt: string): Promise<CryptoKey> {
  return deriveAesKey(pin, saltBytes(salt), ["encrypt"]);
}

describe("Keeper ROTATE_KEYPAIR handler", () => {
  let ephemeralKey: Ed25519Keypair | null;
  let sessionDerivedKey: CryptoKey | null;
  let sessionSalt: string | null;
  let vaultUnlocked: boolean;
  let vaultUnlockExpiry: number | null;
  let sendResponse: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const initialKey = Ed25519Keypair.generate();
    const hashed = await encrypt(initialKey.getSecretKey(), TEST_PIN);
    ephemeralKey = initialKey;
    sessionDerivedKey = await deriveAesKey(TEST_PIN, saltBytes(hashed.salt), [
      "encrypt",
    ]);
    sessionSalt = hashed.salt;
    vaultUnlocked = true;
    vaultUnlockExpiry = Date.now() + TEN_MINUTES_MS;
    sendResponse = vi.fn();
  });

  function checkAndEnforceExpiry(): boolean {
    if (!ephemeralKey) return true;
    if (vaultUnlockExpiry && Date.now() > vaultUnlockExpiry) {
      ephemeralKey = null;
      sessionDerivedKey = null;
      sessionSalt = null;
      vaultUnlocked = false;
      vaultUnlockExpiry = null;
      return true;
    }
    return false;
  }

  async function simulateRotateKeypair(
    encryptWithKeyFn: typeof encryptWithKey = encryptWithKey,
  ) {
    if (checkAndEnforceExpiry() || !sessionDerivedKey || !sessionSalt) {
      sendResponse({
        ok: false,
        error: "Vault must be unlocked again before rotating keypair",
      });
      return false;
    }

    try {
      const newKeypair = Ed25519Keypair.generate();
      const hashedSecretKey = await encryptWithKeyFn(
        newKeypair.getSecretKey(),
        sessionDerivedKey,
        sessionSalt,
      );
      ephemeralKey = newKeypair;
      vaultUnlocked = true;
      vaultUnlockExpiry = Date.now() + TEN_MINUTES_MS;
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
    return true;
  }

  it("generates a new keypair and encrypts it using the cached session key", async () => {
    const originalKey = ephemeralKey as Ed25519Keypair;
    const originalAddress = originalKey.getPublicKey().toSuiAddress();

    await simulateRotateKeypair();

    const response = sendResponse.mock.calls[0][0] as {
      ok: boolean;
      hashedSecretKey: HashedData;
      publicKeyBytes: number[];
    };
    expect(response.ok).toBe(true);
    expect(response.hashedSecretKey).toMatchObject({
      iv: expect.any(String),
      data: expect.any(String),
      salt: sessionSalt,
    });
    const rotatedKey = ephemeralKey as Ed25519Keypair;
    expect(rotatedKey.getPublicKey().toSuiAddress()).not.toBe(originalAddress);
    expect(response.publicKeyBytes).toEqual(
      Array.from(rotatedKey.getPublicKey().toRawBytes()),
    );
  });

  it("only swaps the in-memory key after encryption succeeds", async () => {
    const originalKey = ephemeralKey;

    await simulateRotateKeypair(
      vi
        .fn()
        .mockRejectedValue(
          new Error("encrypt failed"),
        ) as typeof encryptWithKey,
    );

    expect(ephemeralKey).toBe(originalKey);
    expect(sendResponse).toHaveBeenCalledWith({
      ok: false,
      error: "encrypt failed",
    });
  });

  it("returns an unlock-required error when the vault is locked", async () => {
    ephemeralKey = null;

    await simulateRotateKeypair();

    expect(sendResponse).toHaveBeenCalledWith({
      ok: false,
      error: "Vault must be unlocked again before rotating keypair",
    });
  });

  it("returns an unlock-required error when the session key is missing", async () => {
    sessionDerivedKey = null;

    await simulateRotateKeypair();

    expect(sendResponse).toHaveBeenCalledWith({
      ok: false,
      error: "Vault must be unlocked again before rotating keypair",
    });
  });

  it("resets expiry to ten minutes after successful rotation", async () => {
    const before = Date.now();

    await simulateRotateKeypair();

    expect(vaultUnlocked).toBe(true);
    expect(vaultUnlockExpiry).toBeGreaterThanOrEqual(before + TEN_MINUTES_MS);
  });
});

describe("Keeper EPH_SIGN handler", () => {
  let ephemeralKey: Ed25519Keypair | null;
  let vaultUnlockExpiry: number | null;
  let sendResponse: ReturnType<typeof vi.fn>;
  let signWithIntent: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ephemeralKey = Ed25519Keypair.generate();
    vaultUnlockExpiry = Date.now() + TEN_MINUTES_MS;
    sendResponse = vi.fn();
    signWithIntent = vi.fn().mockResolvedValue({
      bytes: "signed-bytes",
      userSignature: "user-signature",
    });
  });

  function checkAndEnforceExpiry(): boolean {
    if (!ephemeralKey) return true;
    if (vaultUnlockExpiry && Date.now() > vaultUnlockExpiry) {
      ephemeralKey = null;
      vaultUnlockExpiry = null;
      return true;
    }
    return false;
  }

  async function simulateEphSign(message: {
    target?: string;
    type: string;
    msgBytes?: number[];
    scope?: string;
    sui_address?: string;
  }) {
    if (message.target !== "KEEPER") return false;
    if (message.type !== KeeperMessageTypes.EPH_SIGN) return false;

    if (checkAndEnforceExpiry()) {
      sendResponse({ error: "[KEEPER_EPH_SIGN] LOCKED" });
      return false;
    }
    const key = ephemeralKey;
    if (!key) {
      sendResponse({ error: "[KEEPER_EPH_SIGN] LOCKED" });
      return false;
    }

    try {
      const messageBytes = new Uint8Array(message.msgBytes as number[]);
      const ephSignature = await signWithIntent(messageBytes, message.scope, {
        sui_address: message.sui_address,
        keypair: key,
      });
      sendResponse({
        ok: true,
        bytes: ephSignature.bytes,
        userSignature: ephSignature.userSignature,
      });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  it("returns LOCKED when the vault is locked", async () => {
    ephemeralKey = null;

    await simulateEphSign({
      target: "KEEPER",
      type: KeeperMessageTypes.EPH_SIGN,
      msgBytes: [1],
    });

    expect(sendResponse).toHaveBeenCalledWith({
      error: "[KEEPER_EPH_SIGN] LOCKED",
    });
  });

  it("returns LOCKED when the unlock has expired", async () => {
    vaultUnlockExpiry = Date.now() - 1;

    await simulateEphSign({
      target: "KEEPER",
      type: KeeperMessageTypes.EPH_SIGN,
      msgBytes: [1],
    });

    expect(ephemeralKey).toBeNull();
    expect(sendResponse).toHaveBeenCalledWith({
      error: "[KEEPER_EPH_SIGN] LOCKED",
    });
  });

  it("converts msgBytes to Uint8Array and signs with intent", async () => {
    const key = ephemeralKey;

    await simulateEphSign({
      target: "KEEPER",
      type: KeeperMessageTypes.EPH_SIGN,
      msgBytes: [1, 2, 3],
      scope: "TransactionData",
      sui_address: "0xabc",
    });

    expect(signWithIntent).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      "TransactionData",
      { sui_address: "0xabc", keypair: key },
    );
    const messageBytes = signWithIntent.mock.calls[0][0] as Uint8Array;
    expect(Array.from(messageBytes)).toEqual([1, 2, 3]);
    expect(sendResponse).toHaveBeenCalledWith({
      ok: true,
      bytes: "signed-bytes",
      userSignature: "user-signature",
    });
  });

  it("returns an error when signWithIntent throws", async () => {
    signWithIntent.mockRejectedValue(new Error("sign failed"));

    await simulateEphSign({
      target: "KEEPER",
      type: KeeperMessageTypes.EPH_SIGN,
      msgBytes: [1, 2, 3],
    });

    expect(sendResponse).toHaveBeenCalledWith({
      ok: false,
      error: "sign failed",
    });
  });

  it("returns false without responding for non-KEEPER targets", async () => {
    const result = await simulateEphSign({
      target: "OTHER",
      type: KeeperMessageTypes.EPH_SIGN,
      msgBytes: [1, 2, 3],
    });

    expect(result).toBe(false);
    expect(sendResponse).not.toHaveBeenCalled();
  });
});

describe("Keeper zkProof handlers", () => {
  let ephemeralKey: Ed25519Keypair | null;
  let vaultUnlockExpiry: number | null;
  let zkProofs: Partial<Record<SuiChain, ZkProofResponse | null>>;
  let sendResponse: ReturnType<typeof vi.fn>;
  const proof = {
    data: { proofPoints: { a: [], b: [], c: [] } },
    error: undefined,
  } as unknown as ZkProofResponse;

  beforeEach(() => {
    ephemeralKey = Ed25519Keypair.generate();
    vaultUnlockExpiry = Date.now() + TEN_MINUTES_MS;
    zkProofs = {
      [SUI_DEVNET_CHAIN]: null,
      [SUI_TESTNET_CHAIN]: null,
      [SUI_MAINNET_CHAIN]: null,
    };
    sendResponse = vi.fn();
  });

  function simulateSetZkProof(message: {
    chain?: SuiChain;
    zkProof?: ZkProofResponse;
  }) {
    if (!ephemeralKey) {
      sendResponse({
        error: "[KEEPER_SET_ZKPROOF] No ephemeral key found, vault LOCKED",
      });
      return false;
    }
    if (!message.chain) {
      sendResponse({ error: "Chain is required" });
      return false;
    }
    zkProofs[message.chain] = message.zkProof;
    sendResponse({ ok: true });
    return false;
  }

  function simulateGetZkProof(message: { chain?: SuiChain }) {
    if (!ephemeralKey) {
      sendResponse({ error: "LOCKED" });
      return false;
    }
    if (!message.chain) {
      sendResponse({ error: "Chain is required" });
      return false;
    }
    sendResponse({ ok: true, zkProof: zkProofs[message.chain] ?? null });
    return false;
  }

  function simulateClearZkProof() {
    zkProofs = {
      [SUI_DEVNET_CHAIN]: null,
      [SUI_TESTNET_CHAIN]: null,
      [SUI_MAINNET_CHAIN]: null,
    };
    sendResponse({ ok: true });
    return false;
  }

  it("SET_ZKPROOF rejects when the vault is locked", () => {
    ephemeralKey = null;

    simulateSetZkProof({ chain: SUI_TESTNET_CHAIN, zkProof: proof });

    expect(sendResponse).toHaveBeenCalledWith({
      error: "[KEEPER_SET_ZKPROOF] No ephemeral key found, vault LOCKED",
    });
  });

  it("SET_ZKPROOF rejects when chain is missing", () => {
    simulateSetZkProof({ zkProof: proof });

    expect(sendResponse).toHaveBeenCalledWith({ error: "Chain is required" });
  });

  it("SET_ZKPROOF stores proof per chain", () => {
    simulateSetZkProof({ chain: SUI_TESTNET_CHAIN, zkProof: proof });

    expect(zkProofs[SUI_TESTNET_CHAIN]).toBe(proof);
    expect(zkProofs[SUI_DEVNET_CHAIN]).toBeNull();
    expect(sendResponse).toHaveBeenCalledWith({ ok: true });
  });

  it("SET_ZKPROOF does not enforce expiry while an ephemeral key is present", () => {
    vaultUnlockExpiry = Date.now() - 1;

    simulateSetZkProof({ chain: SUI_TESTNET_CHAIN, zkProof: proof });

    expect(vaultUnlockExpiry).toBeLessThan(Date.now());
    expect(ephemeralKey).not.toBeNull();
    expect(zkProofs[SUI_TESTNET_CHAIN]).toBe(proof);
    expect(sendResponse).toHaveBeenCalledWith({ ok: true });
  });

  it("GET_ZKPROOF rejects when the vault is locked", () => {
    ephemeralKey = null;

    simulateGetZkProof({ chain: SUI_TESTNET_CHAIN });

    expect(sendResponse).toHaveBeenCalledWith({ error: "LOCKED" });
  });

  it("GET_ZKPROOF rejects when chain is missing", () => {
    simulateGetZkProof({});

    expect(sendResponse).toHaveBeenCalledWith({ error: "Chain is required" });
  });

  it("GET_ZKPROOF returns null for an unset chain", () => {
    simulateGetZkProof({ chain: SUI_TESTNET_CHAIN });

    expect(sendResponse).toHaveBeenCalledWith({ ok: true, zkProof: null });
  });

  it("GET_ZKPROOF returns the proof for the requested chain", () => {
    zkProofs[SUI_DEVNET_CHAIN] = proof;

    simulateGetZkProof({ chain: SUI_DEVNET_CHAIN });

    expect(sendResponse).toHaveBeenCalledWith({ ok: true, zkProof: proof });
  });

  it("CLEAR_ZKPROOF resets every chain regardless of lock state", () => {
    ephemeralKey = null;
    zkProofs[SUI_DEVNET_CHAIN] = proof;
    zkProofs[SUI_TESTNET_CHAIN] = proof;
    zkProofs[SUI_MAINNET_CHAIN] = proof;

    simulateClearZkProof();

    expect(zkProofs).toEqual({
      [SUI_DEVNET_CHAIN]: null,
      [SUI_TESTNET_CHAIN]: null,
      [SUI_MAINNET_CHAIN]: null,
    });
    expect(sendResponse).toHaveBeenCalledWith({ ok: true });
  });

  it("unknown keeper message type sends a standard error", () => {
    const message = { target: "KEEPER", type: "UNKNOWN_MESSAGE" };

    if (
      message.target === "KEEPER" &&
      message.type !== KeeperMessageTypes.SET_ZKPROOF &&
      message.type !== KeeperMessageTypes.GET_ZKPROOF &&
      message.type !== KeeperMessageTypes.CLEAR_ZKPROOF
    ) {
      sendResponse({ error: "Unknown message type" });
    }

    expect(sendResponse).toHaveBeenCalledWith({
      error: "Unknown message type",
    });
  });
});

describe("Keeper LOCALNET_SET_KEYPAIR handler", () => {
  let localnetKey: Ed25519Keypair | null;
  let sessionDerivedKey: CryptoKey | null;
  let sessionSalt: string | null;
  let sendResponse: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localnetKey = null;
    sessionDerivedKey = null;
    sessionSalt = null;
    sendResponse = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function setupUnlockedVaultSession(encryptPlaintextBech32: string) {
    const hashedKey = await encrypt(encryptPlaintextBech32, TEST_PIN);
    sessionDerivedKey = await makeSessionKey(TEST_PIN, hashedKey.salt);
    sessionSalt = hashedKey.salt;
  }

  async function simulateSetKeypair(privateKey: string | undefined) {
    if (!privateKey) {
      sendResponse({ ok: false, error: "privateKey required" });
      return;
    }
    if (!sessionDerivedKey || !sessionSalt) {
      sendResponse({
        ok: false,
        error: "Vault must be unlocked to store localnet key",
      });
      return;
    }
    try {
      if (!privateKey.startsWith(SUI_PRIVATE_KEY_PREFIX)) {
        throw new Error("Invalid private key");
      }
      localnetKey = Ed25519Keypair.fromSecretKey(privateKey);
      const address = localnetKey.getPublicKey().toSuiAddress();
      const encryptedKey = await encryptWithKey(
        privateKey,
        sessionDerivedKey,
        sessionSalt,
      );
      sendResponse({ ok: true, address, encryptedKey });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  it("loads keypair into RAM and returns encrypted blob when vault is unlocked", async () => {
    const { bech32 } = makeTestKey();
    await setupUnlockedVaultSession(bech32);
    await simulateSetKeypair(bech32);

    expect(localnetKey).not.toBeNull();
    const response = sendResponse.mock.calls[0][0] as {
      ok: boolean;
      address: string;
      encryptedKey: HashedData;
    };
    expect(response.ok).toBe(true);
    expect(response.address).toBe(localnetKey!.getPublicKey().toSuiAddress());
    expect(response.encryptedKey).toMatchObject({
      iv: expect.any(String),
      data: expect.any(String),
      salt: expect.any(String),
    });
    expect(response.encryptedKey.data).not.toBe(bech32);
  });

  it("encrypted blob decrypts back to the original private key", async () => {
    const { bech32 } = makeTestKey();
    await setupUnlockedVaultSession(bech32);
    await simulateSetKeypair(bech32);

    const { encryptedKey } = sendResponse.mock.calls[0][0] as {
      encryptedKey: HashedData;
    };
    const decrypted = await decrypt(encryptedKey, TEST_PIN);
    expect(decrypted).toBe(bech32);
  });

  it("returns error when vault is locked (no session key)", async () => {
    const { bech32 } = makeTestKey();

    await simulateSetKeypair(bech32);

    expect(localnetKey).toBeNull();
    expect(sendResponse).toHaveBeenCalledWith({
      ok: false,
      error: "Vault must be unlocked to store localnet key",
    });
  });

  it("returns error when privateKey is missing", async () => {
    await setupUnlockedVaultSession(makeTestKey().bech32);

    await simulateSetKeypair(undefined);

    expect(localnetKey).toBeNull();
    expect(sendResponse).toHaveBeenCalledWith({
      ok: false,
      error: "privateKey required",
    });
  });

  it("returns error when private key does not start with suiprivkey", async () => {
    await setupUnlockedVaultSession(makeTestKey().bech32);

    await simulateSetKeypair("not-a-valid-key");

    expect(localnetKey).toBeNull();
    expect(sendResponse).toHaveBeenCalledWith({
      ok: false,
      error: "Invalid private key",
    });
  });
});

describe("Keeper UNLOCK_VAULT — localnet key restoration", () => {
  let localnetKey: Ed25519Keypair | null;
  let sendResponse: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localnetKey = null;
    sendResponse = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function simulateUnlockWithLocalnetRestore(
    pin: string,
    encryptedLocalnetKey: unknown,
  ) {
    if (
      encryptedLocalnetKey &&
      typeof encryptedLocalnetKey === "object" &&
      "data" in (encryptedLocalnetKey as object)
    ) {
      try {
        const privKey = await decrypt(encryptedLocalnetKey as HashedData, pin);
        localnetKey = Ed25519Keypair.fromSecretKey(privKey);
      } catch {
        localnetKey = null;
      }
    }
    sendResponse({ ok: true });
  }

  it("restores localnet keypair from encrypted blob on unlock", async () => {
    const { keypair, bech32 } = makeTestKey();
    const encrypted = await encrypt(bech32, TEST_PIN);

    await simulateUnlockWithLocalnetRestore(TEST_PIN, encrypted);

    expect(localnetKey).not.toBeNull();
    expect(localnetKey!.getPublicKey().toSuiAddress()).toBe(
      keypair.getPublicKey().toSuiAddress(),
    );
    expect(sendResponse).toHaveBeenCalledWith({ ok: true });
  });

  it("leaves localnetKey null when no encrypted blob is passed", async () => {
    await simulateUnlockWithLocalnetRestore(TEST_PIN, null);

    expect(localnetKey).toBeNull();
    expect(sendResponse).toHaveBeenCalledWith({ ok: true });
  });

  it("leaves localnetKey null and does not throw when blob is malformed", async () => {
    const malformed = { iv: "bad", data: "bad", salt: "bad" };

    await simulateUnlockWithLocalnetRestore(TEST_PIN, malformed);

    expect(localnetKey).toBeNull();
    expect(sendResponse).toHaveBeenCalledWith({ ok: true });
  });

  it("leaves localnetKey null when wrong PIN is used to decrypt", async () => {
    const { bech32 } = makeTestKey();
    const encrypted = await encrypt(bech32, TEST_PIN);

    await simulateUnlockWithLocalnetRestore("wrong-pin", encrypted);

    expect(localnetKey).toBeNull();
    expect(sendResponse).toHaveBeenCalledWith({ ok: true });
  });

  it("ignores a plain string (old unencrypted format) — no 'data' property", async () => {
    await simulateUnlockWithLocalnetRestore(
      TEST_PIN,
      `${SUI_PRIVATE_KEY_PREFIX}1abc`,
    );

    expect(localnetKey).toBeNull();
    expect(sendResponse).toHaveBeenCalledWith({ ok: true });
  });
});
