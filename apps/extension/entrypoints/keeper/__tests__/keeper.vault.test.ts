import {
  decrypt,
  encrypt,
  type HashedData,
  KeeperMessageTypes,
} from "@evevault/shared";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// keeper.ts registers chrome.runtime.onMessage.addListener at module scope.
// Chrome must be stubbed before the dynamic import so the real handler is captured.

type KeeperHandler = (
  message: Record<string, unknown>,
  sender: object,
  sendResponse: (response?: unknown) => void,
) => boolean | undefined;

let keeperHandler: KeeperHandler;

beforeAll(async () => {
  vi.stubGlobal("chrome", {
    runtime: {
      onMessage: {
        addListener: (fn: KeeperHandler) => {
          keeperHandler = fn;
        },
      },
      sendMessage: vi.fn().mockResolvedValue(undefined),
    },
  });
  await import("../keeper");
});

// ── helpers ───────────────────────────────────────────────────────────────────

const TEST_PIN = "123456";

/** Send a KEEPER-targeted message and await the sendResponse callback. */
function dispatch(
  msg: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    keeperHandler({ target: "KEEPER", ...msg }, {}, (resp) =>
      resolve((resp ?? {}) as Record<string, unknown>),
    );
  });
}

/** Dispatch without the KEEPER target — used to test the routing guard. */
function rawDispatch(msg: Record<string, unknown>): {
  returnValue: boolean | void;
  sendResponse: ReturnType<typeof vi.fn>;
} {
  const sendResponse = vi.fn();
  const returnValue = keeperHandler(msg, {}, sendResponse);
  return { returnValue, sendResponse };
}

/** Unlock the vault with a freshly encrypted keypair. */
async function unlockVault(): Promise<{
  keypair: Ed25519Keypair;
  hashedSecretKey: HashedData;
}> {
  const keypair = Ed25519Keypair.generate();
  const hashedSecretKey = await encrypt(keypair.getSecretKey(), TEST_PIN);
  const resp = await dispatch({
    type: KeeperMessageTypes.UNLOCK_VAULT,
    hashedSecretKey,
    pin: TEST_PIN,
  });
  expect(resp.ok).toBe(true);
  return { keypair, hashedSecretKey };
}

afterEach(async () => {
  vi.useRealTimers();
  await dispatch({ type: KeeperMessageTypes.CLEAR_EPHKEY });
  await dispatch({ type: KeeperMessageTypes.CLEAR_ZKPROOF });
  vi.clearAllMocks();
});

// ── CREATE_KEYPAIR ────────────────────────────────────────────────────────────

describe("Keeper CREATE_KEYPAIR handler", () => {
  it("generates an Ed25519 keypair, encrypts it with PIN, and returns hashedSecretKey + publicKeyBytes", async () => {
    const resp = await dispatch({
      type: KeeperMessageTypes.CREATE_KEYPAIR,
      pin: TEST_PIN,
    });

    expect(resp.ok).toBe(true);
    expect(resp.hashedSecretKey).toMatchObject({
      iv: expect.any(String),
      data: expect.any(String),
      salt: expect.any(String),
    });
    expect(Array.isArray(resp.publicKeyBytes)).toBe(true);
    expect((resp.publicKeyBytes as number[]).length).toBeGreaterThan(0);
  });

  it("stores a decryptable keypair — decrypt returns key bytes that reconstruct to the same public key", async () => {
    const resp = await dispatch({
      type: KeeperMessageTypes.CREATE_KEYPAIR,
      pin: TEST_PIN,
    });

    const secretKey = await decrypt(
      resp.hashedSecretKey as HashedData,
      TEST_PIN,
    );
    const reconstructed = Ed25519Keypair.fromSecretKey(secretKey);
    expect(Array.from(reconstructed.getPublicKey().toRawBytes())).toEqual(
      resp.publicKeyBytes,
    );
  });

  it("unlocks the vault — GET_PUBLIC_KEY succeeds immediately after CREATE_KEYPAIR", async () => {
    await dispatch({ type: KeeperMessageTypes.CREATE_KEYPAIR, pin: TEST_PIN });
    const pubResp = await dispatch({ type: KeeperMessageTypes.GET_PUBLIC_KEY });
    expect(pubResp.ok).toBe(true);
    expect(Array.isArray(pubResp.publicKeyBytes)).toBe(true);
  });

  it("enables key rotation — ROTATE_KEYPAIR succeeds after CREATE_KEYPAIR (session key was derived)", async () => {
    await dispatch({ type: KeeperMessageTypes.CREATE_KEYPAIR, pin: TEST_PIN });
    const rotateResp = await dispatch({
      type: KeeperMessageTypes.ROTATE_KEYPAIR,
    });
    expect(rotateResp.ok).toBe(true);
  });
});

// ── UNLOCK_VAULT ──────────────────────────────────────────────────────────────

describe("Keeper UNLOCK_VAULT handler", () => {
  it("decrypts the secret key, reconstructs the keypair, and responds { ok: true }", async () => {
    const keypair = Ed25519Keypair.generate();
    const hashedSecretKey = await encrypt(keypair.getSecretKey(), TEST_PIN);
    const resp = await dispatch({
      type: KeeperMessageTypes.UNLOCK_VAULT,
      hashedSecretKey,
      pin: TEST_PIN,
    });

    expect(resp.ok).toBe(true);
  });

  it("GET_PUBLIC_KEY returns the original public key after unlock", async () => {
    const { keypair } = await unlockVault();
    const pubResp = await dispatch({ type: KeeperMessageTypes.GET_PUBLIC_KEY });

    expect(pubResp.ok).toBe(true);
    expect(pubResp.publicKeyBytes).toEqual(
      Array.from(keypair.getPublicKey().toRawBytes()),
    );
  });

  it("returns a decryption error and leaves vault locked for a wrong PIN", async () => {
    const hashedSecretKey = await encrypt(
      Ed25519Keypair.generate().getSecretKey(),
      TEST_PIN,
    );
    const resp = await dispatch({
      type: KeeperMessageTypes.UNLOCK_VAULT,
      hashedSecretKey,
      pin: "wrong-pin",
    });

    expect(resp.ok).toBe(false);
    expect(String(resp.error)).toContain("[Keeper] Decryption failed");

    const pubResp = await dispatch({ type: KeeperMessageTypes.GET_PUBLIC_KEY });
    expect(pubResp.error).toBe("LOCKED");
  });

  it("returns a keypair reconstruction error when decrypted data is not a valid secret key", async () => {
    const hashedSecretKey = await encrypt("not-a-secret-key", TEST_PIN);
    const resp = await dispatch({
      type: KeeperMessageTypes.UNLOCK_VAULT,
      hashedSecretKey,
      pin: TEST_PIN,
    });

    expect(resp.ok).toBe(false);
    expect(String(resp.error)).toContain("[Keeper] Failed to create keypair");
  });
});

// ── CLEAR_EPHKEY ──────────────────────────────────────────────────────────────

describe("Keeper CLEAR_EPHKEY handler", () => {
  beforeEach(async () => {
    await unlockVault();
  });

  it("responds { ok: true }", async () => {
    const resp = await dispatch({ type: KeeperMessageTypes.CLEAR_EPHKEY });
    expect(resp.ok).toBe(true);
  });

  it("GET_PUBLIC_KEY returns LOCKED after CLEAR_EPHKEY", async () => {
    const before = await dispatch({ type: KeeperMessageTypes.GET_PUBLIC_KEY });
    expect(before.ok).toBe(true);

    await dispatch({ type: KeeperMessageTypes.CLEAR_EPHKEY });

    const after = await dispatch({ type: KeeperMessageTypes.GET_PUBLIC_KEY });
    expect(after.error).toBe("LOCKED");
  });

  it("clears sessionDerivedKey — ROTATE_KEYPAIR fails until re-unlocked", async () => {
    await dispatch({ type: KeeperMessageTypes.CLEAR_EPHKEY });

    const resp = await dispatch({ type: KeeperMessageTypes.ROTATE_KEYPAIR });
    expect(resp.ok).toBe(false);
    expect(String(resp.error)).toContain("Vault must be unlocked again");
  });

  it("does NOT clear zkProofs (CLEAR_ZKPROOF is required for that)", async () => {
    const proof = {
      data: { proofPoints: { a: ["1"], b: [["2", "3"]], c: ["4"] } },
    };
    await dispatch({
      type: KeeperMessageTypes.SET_ZKPROOF,
      chain: "sui:testnet",
      zkProof: proof,
    });

    await dispatch({ type: KeeperMessageTypes.CLEAR_EPHKEY });

    // Re-unlock so the ephemeralKey guard in GET_ZKPROOF passes
    await unlockVault();
    const resp = await dispatch({
      type: KeeperMessageTypes.GET_ZKPROOF,
      chain: "sui:testnet",
    });
    expect(resp.ok).toBe(true);
    expect(resp.zkProof).toEqual(proof);
  });

  it("clears ephemeralKey, sessionDerivedKey, and localnetKey in one CLEAR_EPHKEY call", async () => {
    // Set a localnet key so we can verify it is cleared alongside the ephemeral key
    const localnetKeypair = Ed25519Keypair.generate();
    const setResp = await dispatch({
      type: KeeperMessageTypes.LOCALNET_SET_KEYPAIR,
      privateKey: localnetKeypair.getSecretKey(),
    });
    expect(setResp.ok).toBe(true);
    const addrBefore = await dispatch({
      type: KeeperMessageTypes.LOCALNET_GET_ADDRESS,
    });
    expect(addrBefore.address).not.toBeNull();

    await dispatch({ type: KeeperMessageTypes.CLEAR_EPHKEY });

    // ephemeralKey cleared → GET_PUBLIC_KEY returns LOCKED
    const pubResp = await dispatch({ type: KeeperMessageTypes.GET_PUBLIC_KEY });
    expect(pubResp.error).toBe("LOCKED");

    // sessionDerivedKey (and sessionSalt) cleared → ROTATE_KEYPAIR fails
    const rotateResp = await dispatch({
      type: KeeperMessageTypes.ROTATE_KEYPAIR,
    });
    expect(rotateResp.ok).toBe(false);
    expect(String(rotateResp.error)).toContain("Vault must be unlocked again");

    // localnetKey cleared → LOCALNET_GET_ADDRESS returns null
    // (_vaultUnlocked and _vaultUnlockExpiry are internal and not directly observable)
    const addrAfter = await dispatch({
      type: KeeperMessageTypes.LOCALNET_GET_ADDRESS,
    });
    expect(addrAfter.ok).toBe(true);
    expect(addrAfter.address).toBeNull();
  });

  it("does not clear the vault when target is not KEEPER", async () => {
    const { returnValue, sendResponse } = rawDispatch({
      target: "BACKGROUND",
      type: KeeperMessageTypes.CLEAR_EPHKEY,
    });

    expect(returnValue).toBe(false);
    expect(sendResponse).not.toHaveBeenCalled();

    // Vault is still unlocked
    const pubResp = await dispatch({ type: KeeperMessageTypes.GET_PUBLIC_KEY });
    expect(pubResp.ok).toBe(true);
  });
});

// ── checkAndEnforceExpiry ─────────────────────────────────────────────────────

describe("Keeper vault expiry (checkAndEnforceExpiry)", () => {
  it("GET_PUBLIC_KEY returns LOCKED when the vault has never been unlocked", async () => {
    const resp = await dispatch({ type: KeeperMessageTypes.GET_PUBLIC_KEY });
    expect(resp.error).toBe("LOCKED");
  });

  it("GET_PUBLIC_KEY succeeds when the vault is unlocked and within the expiry window", async () => {
    await unlockVault();
    const resp = await dispatch({ type: KeeperMessageTypes.GET_PUBLIC_KEY });
    expect(resp.ok).toBe(true);
  });

  it("GET_PUBLIC_KEY returns LOCKED after the 10-minute unlock window elapses", async () => {
    await unlockVault();

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 11 * 60 * 1000);

    const resp = await dispatch({ type: KeeperMessageTypes.GET_PUBLIC_KEY });
    expect(resp.error).toBe("LOCKED");
  });

  it("enforces expiry atomically — ROTATE_KEYPAIR also fails once time elapses", async () => {
    await unlockVault();

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 11 * 60 * 1000);

    const resp = await dispatch({ type: KeeperMessageTypes.ROTATE_KEYPAIR });
    expect(resp.ok).toBe(false);
    expect(String(resp.error)).toContain("Vault must be unlocked again");
  });

  it("EPH_SIGN returns LOCKED when neither ephemeralKey nor localnetKey is set", async () => {
    const resp = await dispatch({
      type: KeeperMessageTypes.EPH_SIGN,
      msgBytes: [],
      scope: "TransactionData",
      sui_address: "0x1",
    });
    expect(String(resp.error)).toContain("LOCKED");
  });
});

// ── message guards ────────────────────────────────────────────────────────────

describe("Keeper message guards", () => {
  it("ignores messages not targeted to KEEPER (returns false, no sendResponse called)", () => {
    const { returnValue, sendResponse } = rawDispatch({
      target: "BACKGROUND",
      type: KeeperMessageTypes.GET_PUBLIC_KEY,
    });

    expect(returnValue).toBe(false);
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it("responds with { error: 'Unknown message type' } for unrecognised KEEPER messages", async () => {
    const resp = await dispatch({ type: "NOT_A_REAL_MESSAGE" });
    expect(resp).toEqual({ error: "Unknown message type" });
  });
});
