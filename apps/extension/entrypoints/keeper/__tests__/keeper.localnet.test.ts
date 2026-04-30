import {
  decrypt,
  deriveAesKey,
  encrypt,
  encryptWithKey,
  type HashedData,
  KeeperMessageTypes,
} from "@evevault/shared";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// These tests simulate the keeper handler logic inline (same pattern as keeper.lock.test.ts)
// because keeper.ts is a chrome offscreen document that cannot be imported directly.

const TEST_PIN = "123456";

function makeTestKey(): { keypair: Ed25519Keypair; bech32: string } {
  const keypair = Ed25519Keypair.generate();
  return { keypair, bech32: keypair.getSecretKey() };
}

async function makeSessionKey(pin: string, salt: string): Promise<CryptoKey> {
  const saltBytes = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0));
  return deriveAesKey(pin, saltBytes, ["encrypt"]);
}

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
      if (!privateKey.startsWith("suiprivkey")) {
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
    const hashedKey = await encrypt(makeTestKey().bech32, TEST_PIN);
    sessionDerivedKey = await makeSessionKey(TEST_PIN, hashedKey.salt);
    sessionSalt = hashedKey.salt;

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
    // The encrypted blob must not contain the raw private key
    expect(response.encryptedKey.data).not.toBe(bech32);
  });

  it("encrypted blob decrypts back to the original private key", async () => {
    const { bech32 } = makeTestKey();
    const hashedKey = await encrypt(makeTestKey().bech32, TEST_PIN);
    sessionDerivedKey = await makeSessionKey(TEST_PIN, hashedKey.salt);
    sessionSalt = hashedKey.salt;

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
    const hashedKey = await encrypt(makeTestKey().bech32, TEST_PIN);
    sessionDerivedKey = await makeSessionKey(TEST_PIN, hashedKey.salt);
    sessionSalt = hashedKey.salt;

    await simulateSetKeypair(undefined);

    expect(localnetKey).toBeNull();
    expect(sendResponse).toHaveBeenCalledWith({
      ok: false,
      error: "privateKey required",
    });
  });

  it("returns error when private key does not start with suiprivkey", async () => {
    const hashedKey = await encrypt(makeTestKey().bech32, TEST_PIN);
    sessionDerivedKey = await makeSessionKey(TEST_PIN, hashedKey.salt);
    sessionSalt = hashedKey.salt;

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
    await simulateUnlockWithLocalnetRestore(TEST_PIN, "suiprivkey1abc");

    expect(localnetKey).toBeNull();
    expect(sendResponse).toHaveBeenCalledWith({ ok: true });
  });
});
