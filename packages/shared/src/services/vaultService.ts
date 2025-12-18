import type { PublicKey, Signer } from "@mysten/sui/cryptography";
import type { SuiChain } from "@mysten/wallet-standard";
import type { ZkProofResponse } from "../types/enoki";
import type { StoredSecretKey } from "../types/stores";
import { createWebCryptoPlaceholder } from "../types/wallet";
import { isWeb } from "../utils/environment";
import {
  ephKeyService as keeperEphKeyService,
  zkProofService as keeperZkProofService,
} from "./keeperService";
import { webVaultService } from "./webVaultService";

/**
 * Unified vault service that routes to the appropriate implementation:
 * - Extension: Uses keeperService (offscreen keeper via chrome.runtime messages)
 * - Web: Uses webVaultService (WebCryptoSigner with IndexedDB)
 */
export const ephKeyService = {
  /**
   * Initialize the service (required for web, no-op for extension)
   */
  async initialize(): Promise<void> {
    if (isWeb()) {
      await webVaultService.initialize();
    }
    // Extension: keeperService doesn't need initialization
  },

  /**
   * Unlocks the vault by decrypting the stored secret key and loading it into memory
   */
  async unlockVault(
    hashedSecretKey: StoredSecretKey,
    password: string,
  ): Promise<PublicKey | null> {
    if (isWeb()) {
      if (!password || password.trim().length === 0) {
        throw new Error("PIN is required to unlock");
      }

      await webVaultService.initialize();

      const hasKeypair = await webVaultService.hasKeypair();
      if (!hasKeypair) {
        throw new Error(
          "No keypair exists. Use createEphemeralKeyPair() to create one first.",
        );
      }

      const success = await webVaultService.unlock(password);
      if (!success) {
        throw new Error("Failed to unlock vault");
      }
      return webVaultService.getPublicKey();
    }

    // Extension: delegate to keeperService
    return keeperEphKeyService.unlockVault(hashedSecretKey, password);
  },

  /**
   * Creates a new ephemeral key pair
   */
  async createEphemeralKeyPair(password: string): Promise<{
    hashedSecretKey: StoredSecretKey;
    publicKey: PublicKey;
  }> {
    if (isWeb()) {
      if (!password || password.trim().length === 0) {
        throw new Error("PIN is required to create keypair");
      }

      const publicKey = await webVaultService.createEphemeralKeyPair(password);
      const webPlaceholderKey = createWebCryptoPlaceholder();

      return { hashedSecretKey: webPlaceholderKey, publicKey };
    }

    // Extension: delegate to keeperService
    return keeperEphKeyService.createEphemeralKeyPair(password);
  },

  /**
   * Gets the current ephemeral public key
   */
  async getEphemeralPublicKey(): Promise<PublicKey | null> {
    if (isWeb()) {
      await webVaultService.initialize();
      return webVaultService.getPublicKey();
    }

    // Extension: delegate to keeperService
    return keeperEphKeyService.getEphemeralPublicKey();
  },

  /**
   * Gets the public key bytes for storage/serialization
   */
  async getEphemeralPublicKeyBytes(): Promise<number[] | null> {
    const publicKey = await ephKeyService.getEphemeralPublicKey();
    if (!publicKey) return null;
    return Array.from(publicKey.toRawBytes());
  },

  /**
   * Gets the signer for signing operations (web only)
   * Extension uses ZK_SIGN_BYTES message instead
   */
  getSigner(): Signer | null {
    if (isWeb()) {
      return webVaultService.getSigner() as Signer | null;
    }
    // Extension doesn't expose signer directly - use signBytes instead
    return null;
  },

  /**
   * Checks if the vault is unlocked
   */
  isUnlocked(): boolean {
    if (isWeb()) {
      return webVaultService.isUnlocked();
    }
    // Extension: would need to check with background script
    // For now, assume unlocked if we can get the public key
    return true;
  },

  /**
   * Checks if a keypair exists
   */
  async hasKeypair(): Promise<boolean> {
    if (isWeb()) {
      await webVaultService.initialize();
      return webVaultService.hasKeypair();
    }
    // Extension: try to get public key via keeperService
    const publicKey = await keeperEphKeyService.getEphemeralPublicKey();
    return publicKey !== null;
  },

  /**
   * Locks the vault
   */
  lock(): void {
    if (isWeb()) {
      webVaultService.lock();
    }
    // Extension: managed by offscreen keeper
  },

  /**
   * Clears the keypair (use for logout)
   */
  async clear(): Promise<void> {
    if (isWeb()) {
      await webVaultService.clear();
    }
    // Extension: keypair is managed by offscreen keeper
  },
};

/**
 * Unified zkProof service that routes to the appropriate implementation:
 * - Extension: Uses keeperService (offscreen keeper via chrome.runtime messages)
 * - Web: Uses webVaultService (in-memory + IndexedDB)
 */
export const zkProofService = {
  /**
   * Stores a zkProof for a specific chain
   */
  async setZkProof(chain: SuiChain, zkProof: ZkProofResponse): Promise<void> {
    if (isWeb()) {
      await webVaultService.setZkProof(chain, zkProof);
      return;
    }

    // Extension: delegate to keeperService
    return keeperZkProofService.setZkProof(chain, zkProof);
  },

  /**
   * Gets the zkProof for a specific chain
   */
  async getZkProof(chain: SuiChain): Promise<ZkProofResponse | null> {
    if (isWeb()) {
      return webVaultService.getZkProof(chain);
    }

    // Extension: delegate to keeperService
    return keeperZkProofService.getZkProof(chain);
  },
};
