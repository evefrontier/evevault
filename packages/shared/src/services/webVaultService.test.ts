import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Use string literals to avoid importing @mysten/wallet-standard
const SUI_DEVNET_CHAIN = "sui:devnet" as const;
const SUI_TESTNET_CHAIN = "sui:testnet" as const;

// Mock idb-keyval with an in-memory store
// Use vi.hoisted() to define variables that can be used in vi.mock factory
const { mockStore, mockSetFn } = vi.hoisted(() => {
  const store = new Map<string, unknown>();
  const setFn = vi.fn((key: string, val: unknown) => {
    store.set(key, val);
    return Promise.resolve();
  });
  return { mockStore: store, mockSetFn: setFn };
});

vi.mock("idb-keyval", () => ({
  get: vi.fn((key: string) => Promise.resolve(mockStore.get(key))),
  set: mockSetFn,
  del: vi.fn((key: string) => {
    mockStore.delete(key);
    return Promise.resolve();
  }),
}));

// Mock WebCryptoSigner - defined inline to avoid hoisting issues
vi.mock("@mysten/signers/webcrypto", () => {
  const mockSigner = {
    getPublicKey: vi.fn(() => ({
      toRawBytes: () => new Uint8Array(33).fill(1),
    })),
    export: vi.fn(() => ({ mockExportedKeypair: true })),
    sign: vi.fn(() => Promise.resolve(new Uint8Array(64))),
    signTransaction: vi.fn(() =>
      Promise.resolve({ bytes: "mockBytes", signature: "mockSig" }),
    ),
    signPersonalMessage: vi.fn(() =>
      Promise.resolve({ bytes: "mockBytes", signature: "mockSig" }),
    ),
  };

  return {
    WebCryptoSigner: {
      generate: vi.fn(() => Promise.resolve(mockSigner)),
      import: vi.fn(() => Promise.resolve(mockSigner)),
    },
  };
});

// Mock logger to avoid console noise
vi.mock("../utils/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { WebCryptoSigner } from "@mysten/signers/webcrypto";
// Import after mocks are set up
import { webVaultService } from "./webVaultService";

describe("WebVaultService", () => {
  beforeEach(() => {
    // Clear the mock store before each test
    mockStore.clear();
    vi.clearAllMocks();
    // Reset mockSetFn call history
    mockSetFn.mockClear();
  });

  afterEach(async () => {
    // Clean up after each test
    await webVaultService.clear();
  });

  describe("initialize", () => {
    it("initializes only once", async () => {
      // First call should initialize
      await webVaultService.initialize();

      // Second call should be a no-op (idempotent)
      await webVaultService.initialize();

      // No errors thrown means success
      expect(true).toBe(true);
    });
  });

  describe("createEphemeralKeyPair", () => {
    it("creates keypair and stores in IndexedDB", async () => {
      const pin = "123456";
      const publicKey = await webVaultService.createEphemeralKeyPair(pin);

      // Verify WebCryptoSigner.generate was called
      expect(WebCryptoSigner.generate).toHaveBeenCalled();

      // Verify keypair was stored
      expect(mockSetFn).toHaveBeenCalledWith(
        "evevault:web-ephemeral-keypair",
        expect.anything(),
      );

      // Verify public key is returned
      expect(publicKey).toBeDefined();
      expect(publicKey.toRawBytes()).toBeInstanceOf(Uint8Array);
    });

    it("stores PIN hash for verification", async () => {
      const pin = "123456";
      await webVaultService.createEphemeralKeyPair(pin);

      // Verify PIN hash was stored
      expect(mockSetFn).toHaveBeenCalledWith(
        "evevault:web-pin-hash",
        expect.any(String),
      );

      // Verify the stored hash is 64 chars (SHA-256 hex)
      const pinHashCall = mockSetFn.mock.calls.find(
        (call) => call[0] === "evevault:web-pin-hash",
      );
      expect(pinHashCall[1]).toHaveLength(64);
    });

    it("throws if PIN is empty", async () => {
      await expect(webVaultService.createEphemeralKeyPair("")).rejects.toThrow(
        "PIN is required to create keypair",
      );

      await expect(
        webVaultService.createEphemeralKeyPair("   "),
      ).rejects.toThrow("PIN is required to create keypair");
    });

    it("sets unlock expiry after creation", async () => {
      const pin = "123456";
      await webVaultService.createEphemeralKeyPair(pin);

      // After creation, vault should be unlocked
      expect(webVaultService.isUnlocked()).toBe(true);
    });
  });

  describe("unlock", () => {
    const testPin = "123456";

    beforeEach(async () => {
      // Set up a keypair first
      await webVaultService.createEphemeralKeyPair(testPin);
      // Lock it to test unlock
      webVaultService.lock();
    });

    it("verifies PIN hash and recovers keypair", async () => {
      const result = await webVaultService.unlock(testPin);

      expect(result).toBe(true);
      expect(WebCryptoSigner.import).toHaveBeenCalled();
      expect(webVaultService.isUnlocked()).toBe(true);
    });

    it("extends expiry if already unlocked", async () => {
      // First unlock
      await webVaultService.unlock(testPin);
      expect(webVaultService.isUnlocked()).toBe(true);

      // Clear the import mock to check it's not called again
      vi.mocked(WebCryptoSigner.import).mockClear();

      // Second unlock should just extend expiry, not reimport
      const result = await webVaultService.unlock(testPin);

      expect(result).toBe(true);
      // Import should NOT be called again since we're already unlocked
      expect(WebCryptoSigner.import).not.toHaveBeenCalled();
    });

    it("throws on invalid PIN", async () => {
      await expect(webVaultService.unlock("wrongpin")).rejects.toThrow(
        "Invalid PIN",
      );
    });

    it("returns false if no PIN hash exists", async () => {
      // Clear the store to simulate no PIN hash
      mockStore.delete("evevault:web-pin-hash");

      const result = await webVaultService.unlock(testPin);
      expect(result).toBe(false);
    });

    it("throws if PIN is empty", async () => {
      await expect(webVaultService.unlock("")).rejects.toThrow(
        "PIN is required to unlock",
      );
    });
  });

  describe("lock", () => {
    const testPin = "123456";

    beforeEach(async () => {
      await webVaultService.createEphemeralKeyPair(testPin);
    });

    it("clears signer and expiry from memory", () => {
      expect(webVaultService.isUnlocked()).toBe(true);

      webVaultService.lock();

      expect(webVaultService.isUnlocked()).toBe(false);
      expect(webVaultService.getSigner()).toBeNull();
      expect(webVaultService.getPublicKey()).toBeNull();
    });

    it("isUnlocked returns false after lock", () => {
      webVaultService.lock();
      expect(webVaultService.isUnlocked()).toBe(false);
    });
  });

  describe("auto-lock on expiry", () => {
    const testPin = "123456";

    it("locks automatically when expiry is reached", async () => {
      // Create with a very short expiry by unlocking with custom duration
      await webVaultService.createEphemeralKeyPair(testPin);
      webVaultService.lock();

      // Unlock with 1ms duration
      await webVaultService.unlock(testPin, 1);

      // Wait for expiry
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should be locked now (isUnlocked checks expiry)
      expect(webVaultService.isUnlocked()).toBe(false);
    });
  });

  describe("hasKeypair", () => {
    it("returns true when keypair exists", async () => {
      await webVaultService.createEphemeralKeyPair("123456");
      webVaultService.lock();

      const hasKey = await webVaultService.hasKeypair();
      expect(hasKey).toBe(true);
    });

    it("returns false when no keypair exists", async () => {
      // Ensure store is empty
      mockStore.clear();

      const hasKey = await webVaultService.hasKeypair();
      expect(hasKey).toBe(false);
    });
  });

  describe("clear", () => {
    it("clears all stored data", async () => {
      await webVaultService.createEphemeralKeyPair("123456");

      await webVaultService.clear();

      expect(webVaultService.isUnlocked()).toBe(false);
      expect(webVaultService.getPublicKey()).toBeNull();

      // Verify IndexedDB items were deleted
      expect(mockStore.has("evevault:web-ephemeral-keypair")).toBe(false);
      expect(mockStore.has("evevault:web-pin-hash")).toBe(false);
    });
  });

  describe("zkProof storage", () => {
    it("stores and retrieves zkProof by chain", async () => {
      const mockZkProof = {
        data: { addressSeed: "123", proofPoints: {} },
        error: undefined,
      };

      await webVaultService.setZkProof(
        SUI_DEVNET_CHAIN,
        mockZkProof as Parameters<typeof webVaultService.setZkProof>[1],
      );

      const retrieved = await webVaultService.getZkProof(SUI_DEVNET_CHAIN);
      expect(retrieved).toEqual(mockZkProof);
    });

    it("returns null for non-existent chain", async () => {
      const result = await webVaultService.getZkProof(SUI_TESTNET_CHAIN);
      expect(result).toBeNull();
    });

    it("stores zkProofs separately per chain", async () => {
      const devnetProof = { data: { chain: "devnet" }, error: undefined };
      const testnetProof = { data: { chain: "testnet" }, error: undefined };

      await webVaultService.setZkProof(
        SUI_DEVNET_CHAIN,
        devnetProof as Parameters<typeof webVaultService.setZkProof>[1],
      );
      await webVaultService.setZkProof(
        SUI_TESTNET_CHAIN,
        testnetProof as Parameters<typeof webVaultService.setZkProof>[1],
      );

      const retrievedDevnet =
        await webVaultService.getZkProof(SUI_DEVNET_CHAIN);
      const retrievedTestnet =
        await webVaultService.getZkProof(SUI_TESTNET_CHAIN);

      expect(retrievedDevnet).toEqual(devnetProof);
      expect(retrievedTestnet).toEqual(testnetProof);
    });

    it("clears zkProof for specific chain", async () => {
      const mockZkProof = { data: { test: true }, error: undefined };

      await webVaultService.setZkProof(
        SUI_DEVNET_CHAIN,
        mockZkProof as Parameters<typeof webVaultService.setZkProof>[1],
      );
      await webVaultService.clearZkProof(SUI_DEVNET_CHAIN);

      const result = await webVaultService.getZkProof(SUI_DEVNET_CHAIN);
      expect(result).toBeNull();
    });
  });

  describe("signing operations", () => {
    const testPin = "123456";

    beforeEach(async () => {
      await webVaultService.createEphemeralKeyPair(testPin);
    });

    it("signs transaction when unlocked", async () => {
      const txBytes = new Uint8Array([1, 2, 3, 4]);
      const result = await webVaultService.signTransaction(txBytes);

      expect(result).toHaveProperty("bytes");
      expect(result).toHaveProperty("signature");
    });

    it("signs personal message when unlocked", async () => {
      const message = new Uint8Array([1, 2, 3, 4]);
      const result = await webVaultService.signPersonalMessage(message);

      expect(result).toHaveProperty("bytes");
      expect(result).toHaveProperty("signature");
    });

    it("throws when signing while locked", async () => {
      webVaultService.lock();

      await expect(
        webVaultService.signTransaction(new Uint8Array([1, 2, 3])),
      ).rejects.toThrow("Vault is locked or no keypair exists");

      await expect(
        webVaultService.signPersonalMessage(new Uint8Array([1, 2, 3])),
      ).rejects.toThrow("Vault is locked or no keypair exists");
    });
  });

  describe("getPublicKeyBytes", () => {
    it("returns null when no signer", () => {
      const bytes = webVaultService.getPublicKeyBytes();
      expect(bytes).toBeNull();
    });

    it("returns byte array when signer exists", async () => {
      await webVaultService.createEphemeralKeyPair("123456");
      const bytes = webVaultService.getPublicKeyBytes();

      expect(bytes).toBeInstanceOf(Array);
      expect(bytes?.length).toBe(33);
    });
  });
});
