import { Ed25519PublicKey } from "@mysten/sui/keypairs/ed25519";
import type { SuiChain } from "@mysten/wallet-standard";
import type { ZkProofResponse } from "../types/enoki";
import { VaultMessageTypes, type VaultResponse } from "../types/messages";
import type { StoredSecretKey } from "../types/stores";
import { createLogger } from "../utils/logger";

const log = createLogger();

/**
 * Services for managing the ephemeral key and zkproofs vault in the offscreen keeper.
 * The actual keys are stored in memory in the offscreen document, not in this service.
 */
export const ephKeyService = {
  /**
   * Unlocks the vault by decrypting the stored secret key and loading it into memory
   */
  async unlockVault(
    hashedSecretKey: StoredSecretKey,
    pin: string,
  ): Promise<Ed25519PublicKey | null> {
    if (!hashedSecretKey) {
      throw new Error(
        "No secret key provided. Cannot unlock vault without an existing key. " +
          "Use createEphemeralKeyPair() to create a new key first.",
      );
    }

    log.debug("[ephKeyService] Unlocking vault", hashedSecretKey, pin);

    const res = (await chrome.runtime?.sendMessage?.({
      type: VaultMessageTypes.UNLOCK_VAULT,
      hashedSecretKey: hashedSecretKey,
      pin: pin,
      unlockDurationMs: 10 * 60 * 1000, // 10 minutes
    })) as VaultResponse | undefined;

    if (res?.ok) {
      log.info("Vault unlocked");
      // Refresh the public key after unlocking
      const publicKey = await ephKeyService.getEphemeralPublicKey();
      if (!publicKey) {
        throw new Error("Failed to refresh ephemeral public key");
      }
      return publicKey;
    } else {
      log.error("Failed to unlock vault", res);
      throw new Error(res?.error || "Failed to unlock vault");
    }
  },

  /**
   * Locks the vault by clearing the ephemeral key and zkProofs
   */
  async lock(): Promise<void> {
    log.debug("[ephKeyService] Locking vault");
    const res = (await chrome.runtime?.sendMessage?.({
      type: VaultMessageTypes.LOCK,
    })) as VaultResponse | undefined;

    log.debug("Lock vault response", { ok: res?.ok });

    if (res?.ok) {
      log.info("Vault locked");
    } else {
      log.error("Failed to lock vault", res);
      throw new Error(res?.error || "Failed to lock vault");
    }
  },

  /**
   * Creates a new ephemeral key pair in the offscreen keeper
   */
  async createEphemeralKeyPair(pin: string): Promise<{
    hashedSecretKey: StoredSecretKey;
    publicKey: Ed25519PublicKey;
  }> {
    log.debug("[ephKeyService] Creating ephemeral key pair with pin", pin);

    const res = (await chrome.runtime?.sendMessage?.({
      type: VaultMessageTypes.CREATE_KEYPAIR,
      pin,
    })) as VaultResponse | undefined;

    log.debug("Create ephemeral key pair response", { ok: res?.ok });

    if (res?.ok && res.hashedSecretKey) {
      log.info("Created new ephemeral key pair");
      const publicKey = await ephKeyService.getEphemeralPublicKey();
      if (!publicKey) {
        throw new Error("Failed to refresh ephemeral public key");
      }
      return {
        hashedSecretKey: res.hashedSecretKey,
        publicKey: publicKey,
      };
    } else {
      log.error("Failed to create ephemeral key pair", res);
      throw new Error("Failed to create ephemeral key pair");
    }
  },

  /**
   * Gets the current ephemeral public key from the offscreen keeper
   */
  async getEphemeralPublicKey(): Promise<Ed25519PublicKey | null> {
    const res = (await chrome.runtime?.sendMessage?.({
      type: VaultMessageTypes.GET_PUBLIC_KEY,
    })) as VaultResponse | undefined;

    if (res?.ok && res.publicKeyBytes) {
      log.debug("Refreshed ephemeral public key");
      // Reconstruct Ed25519PublicKey from bytes
      const publicKey = new Ed25519PublicKey(
        new Uint8Array(res.publicKeyBytes),
      );
      return publicKey;
    } else {
      log.error("Failed to get ephemeral public key", res);
      return null;
    }
  },
};

export const zkProofService = {
  /**
   * Stores a zkProof in the keeper for a specific chain
   */
  async setZkProof(chain: SuiChain, zkProof: ZkProofResponse): Promise<void> {
    log.debug("[ephKeyService] Setting zkProof for chain", chain);

    const res = (await chrome.runtime?.sendMessage?.({
      type: VaultMessageTypes.SET_ZKPROOF,
      chain,
      zkProof,
    })) as VaultResponse | undefined;

    if (res?.ok) {
      log.debug("zkProof stored in keeper");
    } else {
      log.error("Failed to set zkProof in keeper", res);
      throw new Error(res?.error || "Failed to set zkProof in keeper");
    }
  },

  /**
   * Gets the zkProof from the keeper for a specific chain
   */
  async getZkProof(chain: SuiChain): Promise<ZkProofResponse | null> {
    log.debug("[ephKeyService] Getting zkProof for chain", chain);

    const res = (await chrome.runtime?.sendMessage?.({
      type: VaultMessageTypes.GET_ZKPROOF,
      chain,
    })) as VaultResponse | undefined;

    if (res?.ok) {
      log.debug("zkProof retrieved from keeper");
      return res.zkProof ?? null;
    } else {
      log.error("Failed to get zkProof from keeper", res);
      // Return null if locked or not found (not an error condition)
      return null;
    }
  },

  /**
   * Clears only the zkProofs from the keeper
   */
  async clear(): Promise<void> {
    log.debug("[ephKeyService] Clearing zkProofs");
    const res = (await chrome.runtime?.sendMessage?.({
      type: VaultMessageTypes.CLEAR_ZKPROOF,
    })) as VaultResponse | undefined;

    log.debug("Clear zkProofs response", { ok: res?.ok });

    if (res?.ok) {
      log.info("zkProofs cleared");
    } else {
      log.error("Failed to clear zkProofs", res);
      throw new Error(res?.error || "Failed to clear zkProofs");
    }
  },
};
