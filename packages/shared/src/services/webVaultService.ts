import { WebCryptoSigner } from "@mysten/signers/webcrypto";
import type { PublicKey } from "@mysten/sui/cryptography";
import type { SuiChain } from "@mysten/wallet-standard";
import { del, get, set } from "idb-keyval";
import type { ZkProofResponse } from "../types/enoki";
import { sha256Hex } from "../utils/keys/sha256";
import { createLogger } from "../utils/logger";

const log = createLogger();

const KEYPAIR_STORAGE_KEY = "evevault:web-ephemeral-keypair";
const PIN_HASH_STORAGE_KEY = "evevault:web-pin-hash";
const ZKPROOF_STORAGE_PREFIX = "evevault:web-zkproof:";

/**
 * Web-specific vault service using WebCryptoSigner (Secp256r1).
 *
 * Security model:
 * - Keys are non-extractable CryptoKeys (hardware-backed security)
 * - The exported keypair handle is stored directly in IndexedDB (required by WebCryptoSigner)
 * - PIN hash is stored separately for UX-level lock/unlock verification
 * - True security comes from the non-extractable nature of the CryptoKey
 */
class WebVaultService {
  private signer: WebCryptoSigner | null = null;
  private unlockExpiry: number | null = null;
  private initialized = false;

  /**
   * Initialize the service. Does not recover the keypair - that happens in unlock().
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    log.debug("[web-vault] Initialized");
  }

  /**
   * Creates a new Secp256r1 ephemeral keypair and stores it with a PIN hash.
   */
  async createEphemeralKeyPair(pin: string): Promise<PublicKey> {
    if (!pin || pin.trim().length === 0) {
      throw new Error("PIN is required to create keypair");
    }

    // Generate new keypair
    this.signer = await WebCryptoSigner.generate();

    // Store the keypair directly in IndexedDB (required by WebCryptoSigner)
    const exported = this.signer.export();
    await set(KEYPAIR_STORAGE_KEY, exported);

    // Store the PIN hash for verification
    const pinHash = await sha256Hex(pin);
    await set(PIN_HASH_STORAGE_KEY, pinHash);

    this.unlockExpiry = Date.now() + 10 * 60 * 1000;

    log.info(
      "[web-vault] Created new Secp256r1 ephemeral keypair (PIN hash stored)",
    );
    return this.signer.getPublicKey();
  }

  /**
   * Unlocks the vault by verifying the PIN and recovering the keypair.
   */
  async unlock(pin: string, durationMs = 10 * 60 * 1000): Promise<boolean> {
    if (!pin || pin.trim().length === 0) {
      throw new Error("PIN is required to unlock");
    }

    // If already unlocked with valid signer, just extend the expiry
    if (this.signer && this.unlockExpiry && Date.now() < this.unlockExpiry) {
      this.unlockExpiry = Date.now() + durationMs;
      log.debug("[web-vault] Vault already unlocked, extended expiry");
      return true;
    }

    // Verify PIN hash
    const storedPinHash = await get(PIN_HASH_STORAGE_KEY);
    if (!storedPinHash) {
      log.error("[web-vault] No PIN hash found");
      return false;
    }

    const providedPinHash = await sha256Hex(pin);
    if (providedPinHash !== storedPinHash) {
      log.error("[web-vault] Invalid PIN");
      throw new Error("Invalid PIN");
    }

    // Recover keypair from IndexedDB
    try {
      const exported = await get(KEYPAIR_STORAGE_KEY);
      if (!exported) {
        log.error("[web-vault] No keypair found in IndexedDB");
        return false;
      }

      this.signer = await WebCryptoSigner.import(exported);
      this.unlockExpiry = Date.now() + durationMs;

      log.info(
        `[web-vault] Vault unlocked for ${durationMs / 1000 / 60} minutes`,
      );
      return true;
    } catch (error) {
      log.error("[web-vault] Failed to recover keypair:", error);
      throw new Error("Failed to recover keypair");
    }
  }

  getPublicKey(): PublicKey | null {
    return this.signer?.getPublicKey() ?? null;
  }

  getPublicKeyBytes(): number[] | null {
    const publicKey = this.signer?.getPublicKey();
    if (!publicKey) return null;
    return Array.from(publicKey.toRawBytes());
  }

  getSigner(): WebCryptoSigner | null {
    if (!this.isUnlocked()) return null;
    return this.signer;
  }

  isUnlocked(): boolean {
    if (!this.signer) return false;

    if (this.unlockExpiry && Date.now() > this.unlockExpiry) {
      this.lock();
      return false;
    }

    return true;
  }

  lock(): void {
    this.unlockExpiry = null;
    // Clear the signer from memory on lock for security
    this.signer = null;
    log.debug("[web-vault] Vault locked");
  }

  /**
   * Checks if a keypair exists in IndexedDB.
   */
  async hasKeypair(): Promise<boolean> {
    const exported = await get(KEYPAIR_STORAGE_KEY);
    return exported !== null && exported !== undefined;
  }

  async clear(): Promise<void> {
    this.signer = null;
    this.unlockExpiry = null;
    await del(KEYPAIR_STORAGE_KEY);
    await del(PIN_HASH_STORAGE_KEY);
    log.info("[web-vault] Cleared keypair and PIN hash");
  }

  async signTransaction(txBytes: Uint8Array): Promise<{
    bytes: string;
    signature: string;
  }> {
    const signer = this.getSigner();
    if (!signer) throw new Error("Vault is locked or no keypair exists");
    return signer.signTransaction(txBytes);
  }

  async signPersonalMessage(message: Uint8Array): Promise<{
    bytes: string;
    signature: string;
  }> {
    const signer = this.getSigner();
    if (!signer) throw new Error("Vault is locked or no keypair exists");
    return signer.signPersonalMessage(message);
  }

  async sign(data: Uint8Array): Promise<Uint8Array> {
    const signer = this.getSigner();
    if (!signer) throw new Error("Vault is locked or no keypair exists");
    return signer.sign(data);
  }

  /**
   * Stores a zkProof for a specific chain in IndexedDB.
   */
  async setZkProof(chain: SuiChain, zkProof: ZkProofResponse): Promise<void> {
    const key = `${ZKPROOF_STORAGE_PREFIX}${chain}`;
    await set(key, zkProof);
    log.debug("[web-vault] zkProof stored for chain", chain);
  }

  /**
   * Gets the zkProof for a specific chain from IndexedDB.
   */
  async getZkProof(chain: SuiChain): Promise<ZkProofResponse | null> {
    const key = `${ZKPROOF_STORAGE_PREFIX}${chain}`;
    const zkProof = await get(key);
    return zkProof ?? null;
  }

  /**
   * Clears zkProof for a specific chain.
   */
  async clearZkProof(chain: SuiChain): Promise<void> {
    const key = `${ZKPROOF_STORAGE_PREFIX}${chain}`;
    await del(key);
    log.debug("[web-vault] zkProof cleared for chain", chain);
  }
}

export const webVaultService = new WebVaultService();
