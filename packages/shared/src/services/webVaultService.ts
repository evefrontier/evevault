import { ZKWebCryptoSigner } from '@evefrontier/wallet-core/crypto'
import type { ZkProofResponse } from '@evevault/shared/types/zkLogin'
import type { PublicKey } from '@mysten/sui/cryptography'
import type { SuiChain } from '@mysten/wallet-standard'
import { VAULT_UNLOCK_MS } from '#/utils/constants'
import { del, get, set } from '#/utils/indexedDbKeyval'
import { createPinVerifier, verifyPin } from '#/utils/keys/pinVerifier'
import { createLogger } from '#/utils/logger'
import { VaultSession } from '#/utils/vaultSession'

const log = createLogger()

const KEYPAIR_STORAGE_KEY = 'evevault:web-ephemeral-keypair'
const PIN_VERIFIER_STORAGE_KEY = 'evevault:web-pin-verifier'
const ZKPROOF_STORAGE_PREFIX = 'evevault:web-zkproof:'

/**
 * Web-specific vault service using ZKWebCryptoSigner (Secp256r1).
 *
 * Security model:
 * - Keys are non-extractable CryptoKeys (hardware-backed security)
 * - The exported keypair handle is stored directly in IndexedDB (required by WebCryptoSigner)
 * - An Argon2id PIN verifier is stored separately for UX-level lock/unlock verification
 * - True security comes from the non-extractable nature of the CryptoKey
 */
class WebVaultService {
  private signer: ZKWebCryptoSigner | null = null
  // Unlock-window timing lives in the shared VaultSession (see
  // utils/vaultSession). The extension keeper (keeperState) uses the same class,
  // so the expiry rule stays identical across both surfaces.
  private session = new VaultSession()
  private initialized = false

  /**
   * Initialize the service. Does not recover the keypair - that happens in unlock().
   */
  async initialize(): Promise<void> {
    if (this.initialized) return
    this.initialized = true
    log.debug('[web-vault] Initialized')
  }

  /**
   * Creates a new Secp256r1 ephemeral keypair and stores it with a PIN verifier.
   */
  async createEphemeralKeyPair(pin: string): Promise<PublicKey> {
    if (!pin || pin.trim().length === 0) {
      throw new Error('PIN is required to create keypair')
    }

    // Generate new keypair
    this.signer = await ZKWebCryptoSigner.generate()

    // Store the keypair directly in IndexedDB (required by ZKWebCryptoSigner)
    const exported = this.signer.export()
    await set(KEYPAIR_STORAGE_KEY, exported)

    // Store an Argon2id PIN verifier (salt + params embedded) for unlock checks
    const pinVerifier = await createPinVerifier(pin)
    await set(PIN_VERIFIER_STORAGE_KEY, pinVerifier)

    this.session.unlock()

    log.info(
      '[web-vault] Created new Secp256r1 ephemeral keypair (PIN verifier stored)',
    )
    return this.signer.getPublicKey()
  }

  /**
   * Unlocks the vault by verifying the PIN and recovering the keypair.
   */
  async unlock(pin: string, durationMs = VAULT_UNLOCK_MS): Promise<boolean> {
    if (!pin || pin.trim().length === 0) {
      throw new Error('PIN is required to unlock')
    }

    // If already unlocked with valid signer, just extend the expiry
    if (this.signer && this.session.isActive()) {
      this.session.unlock(durationMs)
      log.debug('[web-vault] Vault already unlocked, extended expiry')
      return true
    }

    // Verify PIN against the stored Argon2id verifier
    const storedPinVerifier = await get<string>(PIN_VERIFIER_STORAGE_KEY)
    if (!storedPinVerifier) {
      log.error('[web-vault] No PIN verifier found')
      return false
    }

    const pinValid = await verifyPin(pin, storedPinVerifier)
    if (!pinValid) {
      log.error('[web-vault] Invalid PIN')
      throw new Error('Invalid PIN')
    }

    // Recover keypair from IndexedDB
    try {
      const exported =
        await get<ReturnType<ZKWebCryptoSigner['export']>>(KEYPAIR_STORAGE_KEY)
      if (!exported) {
        log.error('[web-vault] No keypair found in IndexedDB')
        return false
      }

      this.signer = new ZKWebCryptoSigner(
        exported.privateKey,
        exported.publicKey,
      )
      this.session.unlock(durationMs)

      log.info(
        `[web-vault] Vault unlocked for ${durationMs / 1000 / 60} minutes`,
      )
      return true
    } catch (error) {
      log.error('[web-vault] Failed to recover keypair:', error)
      throw new Error('Failed to recover keypair')
    }
  }

  getPublicKey(): PublicKey | null {
    return this.signer?.getPublicKey() ?? null
  }

  getPublicKeyBytes(): number[] | null {
    const publicKey = this.signer?.getPublicKey()
    if (!publicKey) return null
    return Array.from(publicKey.toRawBytes())
  }

  getSigner(): ZKWebCryptoSigner | null {
    if (!this.isUnlocked()) return null
    return this.signer
  }

  isUnlocked(): boolean {
    if (!this.signer) return false

    // Lazily lock (and drop the signer) the moment the window has elapsed.
    if (!this.session.isActive()) {
      this.lock()
      return false
    }

    return true
  }

  lock(): void {
    this.session.clear()
    this.signer = null
    log.debug('[web-vault] Vault locked')
  }

  /** Milliseconds left on the unlock window; 0 when locked. */
  getUnlockRemainingMs(): number {
    return this.signer ? this.session.remainingMs() : 0
  }

  /**
   * Checks if a keypair exists in IndexedDB.
   */
  async hasKeypair(): Promise<boolean> {
    const exported =
      await get<ReturnType<ZKWebCryptoSigner['export']>>(KEYPAIR_STORAGE_KEY)
    return exported !== null && exported !== undefined
  }

  async clear(): Promise<void> {
    this.signer = null
    this.session.clear()
    await del(KEYPAIR_STORAGE_KEY)
    await del(PIN_VERIFIER_STORAGE_KEY)
    log.info('[web-vault] Cleared keypair and PIN verifier')
  }

  async rotateEphemeralKeyPair(): Promise<PublicKey> {
    if (!this.isUnlocked()) {
      throw new Error('Vault must be unlocked again before rotating keypair')
    }

    // Generate a new keypair. The PIN verifier in IndexedDB is unchanged — the
    // user's PIN hasn't changed, only the ephemeral key has been rotated.
    const newSigner = await ZKWebCryptoSigner.generate()
    const exported = newSigner.export()
    await set(KEYPAIR_STORAGE_KEY, exported)

    // Only swap the in-memory keypair after successful write
    this.signer = newSigner

    log.info('[web-vault] Rotated Secp256r1 ephemeral keypair')
    return this.signer.getPublicKey()
  }

  async signTransaction(txBytes: Uint8Array): Promise<{
    bytes: string
    signature: string
  }> {
    const signer = this.getSigner()
    if (!signer) throw new Error('Vault is locked or no keypair exists')
    return signer.signTransaction(txBytes)
  }

  async signPersonalMessage(message: Uint8Array): Promise<{
    bytes: string
    signature: string
  }> {
    const signer = this.getSigner()
    if (!signer) throw new Error('Vault is locked or no keypair exists')
    return signer.signPersonalMessage(message)
  }

  async sign(data: Uint8Array): Promise<Uint8Array> {
    const signer = this.getSigner()
    if (!signer) throw new Error('Vault is locked or no keypair exists')
    return signer.sign(data)
  }

  /**
   * Stores a zkProof for a specific chain in IndexedDB.
   */
  async setZkProof(chain: SuiChain, zkProof: ZkProofResponse): Promise<void> {
    const key = `${ZKPROOF_STORAGE_PREFIX}${chain}`
    await set(key, zkProof)
    log.debug('[web-vault] zkProof stored for chain', chain)
  }

  /**
   * Gets the zkProof for a specific chain from IndexedDB.
   */
  async getZkProof(chain: SuiChain): Promise<ZkProofResponse | null> {
    const key = `${ZKPROOF_STORAGE_PREFIX}${chain}`
    const zkProof = await get<ZkProofResponse>(key)
    return zkProof ?? null
  }

  /**
   * Clears zkProof for a specific chain.
   */
  async clearZkProof(chain: SuiChain): Promise<void> {
    const key = `${ZKPROOF_STORAGE_PREFIX}${chain}`
    await del(key)
    log.debug('[web-vault] zkProof cleared for chain', chain)
  }
}

export const webVaultService = new WebVaultService()
