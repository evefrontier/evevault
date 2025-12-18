import { beforeEach, describe, expect, it, vi } from "vitest";

// Use string literal to avoid importing @mysten/wallet-standard
const SUI_DEVNET_CHAIN = "sui:devnet" as const;

// Mock environment detection - defined inline to avoid hoisting issues
let mockIsWebValue = true;
vi.mock("../utils/environment", () => ({
  isWeb: () => mockIsWebValue,
}));

// Mock webVaultService - defined inline
vi.mock("./webVaultService", () => ({
  webVaultService: {
    initialize: vi.fn(() => Promise.resolve()),
    hasKeypair: vi.fn(() => Promise.resolve(true)),
    unlock: vi.fn(() => Promise.resolve(true)),
    getPublicKey: vi.fn(() => ({ toRawBytes: () => new Uint8Array(33) })),
    createEphemeralKeyPair: vi.fn(() =>
      Promise.resolve({ toRawBytes: () => new Uint8Array(33) }),
    ),
    getSigner: vi.fn(() => ({ sign: vi.fn() })),
    isUnlocked: vi.fn(() => true),
    lock: vi.fn(),
    clear: vi.fn(() => Promise.resolve()),
    setZkProof: vi.fn(() => Promise.resolve()),
    getZkProof: vi.fn(() => Promise.resolve({ data: { test: true } })),
  },
}));

// Mock keeperService - defined inline
vi.mock("./keeperService", () => ({
  ephKeyService: {
    unlockVault: vi.fn(() =>
      Promise.resolve({ toRawBytes: () => new Uint8Array(32) }),
    ),
    createEphemeralKeyPair: vi.fn(() =>
      Promise.resolve({
        hashedSecretKey: { iv: "test", data: "test" },
        publicKey: { toRawBytes: () => new Uint8Array(32) },
      }),
    ),
    getEphemeralPublicKey: vi.fn(() =>
      Promise.resolve({ toRawBytes: () => new Uint8Array(32) }),
    ),
  },
  zkProofService: {
    setZkProof: vi.fn(() => Promise.resolve()),
    getZkProof: vi.fn(() => Promise.resolve({ data: { keeper: true } })),
  },
}));

// Mock wallet types
vi.mock("../types/wallet", () => ({
  createWebCryptoPlaceholder: vi.fn(() => ({
    iv: "web-placeholder",
    data: "web-placeholder",
  })),
}));

import {
  ephKeyService as keeperEphKeyService,
  zkProofService as keeperZkProofService,
} from "./keeperService";
// Import after all mocks are set up
import { ephKeyService, zkProofService } from "./vaultService";
import { webVaultService } from "./webVaultService";

describe("ephKeyService routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when isWeb() returns true", () => {
    beforeEach(() => {
      mockIsWebValue = true;
    });

    it("routes initialize to webVaultService", async () => {
      await ephKeyService.initialize();

      expect(webVaultService.initialize).toHaveBeenCalled();
    });

    it("routes unlockVault to webVaultService", async () => {
      const result = await ephKeyService.unlockVault(null, "123456");

      expect(webVaultService.initialize).toHaveBeenCalled();
      expect(webVaultService.hasKeypair).toHaveBeenCalled();
      expect(webVaultService.unlock).toHaveBeenCalledWith("123456");
      expect(webVaultService.getPublicKey).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it("throws if no keypair exists when unlocking", async () => {
      vi.mocked(webVaultService.hasKeypair).mockResolvedValueOnce(false);

      await expect(ephKeyService.unlockVault(null, "123456")).rejects.toThrow(
        "No keypair exists",
      );
    });

    it("throws if PIN is empty when unlocking", async () => {
      await expect(ephKeyService.unlockVault(null, "")).rejects.toThrow(
        "PIN is required to unlock",
      );
    });

    it("routes createEphemeralKeyPair to webVaultService", async () => {
      const result = await ephKeyService.createEphemeralKeyPair("123456");

      expect(webVaultService.createEphemeralKeyPair).toHaveBeenCalledWith(
        "123456",
      );
      expect(result).toHaveProperty("hashedSecretKey");
      expect(result).toHaveProperty("publicKey");
      // Web uses placeholder for hashedSecretKey
      expect(result.hashedSecretKey).toEqual({
        iv: "web-placeholder",
        data: "web-placeholder",
      });
    });

    it("throws if PIN is empty when creating keypair", async () => {
      await expect(ephKeyService.createEphemeralKeyPair("")).rejects.toThrow(
        "PIN is required to create keypair",
      );
    });

    it("routes getEphemeralPublicKey to webVaultService", async () => {
      const result = await ephKeyService.getEphemeralPublicKey();

      expect(webVaultService.initialize).toHaveBeenCalled();
      expect(webVaultService.getPublicKey).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it("routes getSigner to webVaultService", () => {
      const result = ephKeyService.getSigner();

      expect(webVaultService.getSigner).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it("routes isUnlocked to webVaultService", () => {
      const result = ephKeyService.isUnlocked();

      expect(webVaultService.isUnlocked).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("routes hasKeypair to webVaultService", async () => {
      const result = await ephKeyService.hasKeypair();

      expect(webVaultService.initialize).toHaveBeenCalled();
      expect(webVaultService.hasKeypair).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("routes lock to webVaultService", () => {
      ephKeyService.lock();

      expect(webVaultService.lock).toHaveBeenCalled();
    });

    it("routes clear to webVaultService", async () => {
      await ephKeyService.clear();

      expect(webVaultService.clear).toHaveBeenCalled();
    });
  });

  describe("when isWeb() returns false (extension)", () => {
    beforeEach(() => {
      mockIsWebValue = false;
    });

    it("routes unlockVault to keeperService", async () => {
      const hashedKey = { iv: "test", data: "encrypted" };
      await ephKeyService.unlockVault(hashedKey, "123456");

      expect(keeperEphKeyService.unlockVault).toHaveBeenCalledWith(
        hashedKey,
        "123456",
      );
    });

    it("routes createEphemeralKeyPair to keeperService", async () => {
      const result = await ephKeyService.createEphemeralKeyPair("123456");

      expect(keeperEphKeyService.createEphemeralKeyPair).toHaveBeenCalledWith(
        "123456",
      );
      expect(result).toHaveProperty("hashedSecretKey");
      expect(result).toHaveProperty("publicKey");
    });

    it("routes getEphemeralPublicKey to keeperService", async () => {
      await ephKeyService.getEphemeralPublicKey();

      expect(keeperEphKeyService.getEphemeralPublicKey).toHaveBeenCalled();
    });

    it("returns null for getSigner in extension context", () => {
      const result = ephKeyService.getSigner();

      // Extension doesn't expose signer directly
      expect(result).toBeNull();
    });

    it("returns true for isUnlocked in extension context", () => {
      // Extension assumes unlocked (would need to check with background)
      const result = ephKeyService.isUnlocked();
      expect(result).toBe(true);
    });

    it("routes hasKeypair check via getEphemeralPublicKey", async () => {
      await ephKeyService.hasKeypair();

      expect(keeperEphKeyService.getEphemeralPublicKey).toHaveBeenCalled();
    });

    it("does not call webVaultService.lock in extension context", () => {
      ephKeyService.lock();

      expect(webVaultService.lock).not.toHaveBeenCalled();
    });

    it("does not call webVaultService.clear in extension context", async () => {
      await ephKeyService.clear();

      expect(webVaultService.clear).not.toHaveBeenCalled();
    });
  });

  describe("getEphemeralPublicKeyBytes", () => {
    beforeEach(() => {
      mockIsWebValue = true;
    });

    it("returns byte array from public key", async () => {
      const result = await ephKeyService.getEphemeralPublicKeyBytes();

      expect(result).toBeInstanceOf(Array);
      expect(result?.length).toBe(33);
    });

    it("returns null when no public key", async () => {
      vi.mocked(webVaultService.getPublicKey).mockReturnValueOnce(null);

      const result = await ephKeyService.getEphemeralPublicKeyBytes();

      expect(result).toBeNull();
    });
  });
});

describe("zkProofService routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when isWeb() returns true", () => {
    beforeEach(() => {
      mockIsWebValue = true;
    });

    it("routes setZkProof to webVaultService", async () => {
      const mockProof = { data: { test: true }, error: undefined };
      await zkProofService.setZkProof(
        SUI_DEVNET_CHAIN,
        mockProof as Parameters<typeof zkProofService.setZkProof>[1],
      );

      expect(webVaultService.setZkProof).toHaveBeenCalledWith(
        SUI_DEVNET_CHAIN,
        mockProof,
      );
    });

    it("routes getZkProof to webVaultService", async () => {
      const result = await zkProofService.getZkProof(SUI_DEVNET_CHAIN);

      expect(webVaultService.getZkProof).toHaveBeenCalledWith(SUI_DEVNET_CHAIN);
      expect(result).toEqual({ data: { test: true } });
    });
  });

  describe("when isWeb() returns false (extension)", () => {
    beforeEach(() => {
      mockIsWebValue = false;
    });

    it("routes setZkProof to keeperService", async () => {
      const mockProof = { data: { test: true }, error: undefined };
      await zkProofService.setZkProof(
        SUI_DEVNET_CHAIN,
        mockProof as Parameters<typeof zkProofService.setZkProof>[1],
      );

      expect(keeperZkProofService.setZkProof).toHaveBeenCalledWith(
        SUI_DEVNET_CHAIN,
        mockProof,
      );
    });

    it("routes getZkProof to keeperService", async () => {
      const result = await zkProofService.getZkProof(SUI_DEVNET_CHAIN);

      expect(keeperZkProofService.getZkProof).toHaveBeenCalledWith(
        SUI_DEVNET_CHAIN,
      );
      expect(result).toEqual({ data: { keeper: true } });
    });
  });
});
