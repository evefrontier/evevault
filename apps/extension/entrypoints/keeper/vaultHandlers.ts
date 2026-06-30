import {
  ZKEd25519Keypair,
  type ZKProofData,
} from '@evefrontier/wallet-core/crypto'
import { encrypt, encryptWithKey, type HashedData } from '@evevault/shared'
import { createLogger } from '@evevault/shared/utils'
import type { BackgroundMessage } from '@/lib/background/types'
import {
  cacheSessionKey,
  decryptVaultSecret,
  getErrorMessage,
  publicKeyBytes,
  restoreUnlockedVault,
} from './keeperCrypto'
import {
  enforceExpiry,
  getEphemeralKey,
  getSessionKey,
  getUnlockRemainingMs,
  keeperReplaceEphemeralKey,
  lockVault,
  unlockVaultWithKeypair,
} from './keeperState'
import type { KeeperSendResponse } from './keeperTypes'

const log = createLogger()

export function handleCreateKeypair(
  message: BackgroundMessage,
  sendResponse: KeeperSendResponse,
): boolean {
  const pin = message.pin as string
  const keypair = ZKEd25519Keypair.generate()

  // Chrome keeps the response channel open only when the listener returns true.
  ;(async () => {
    try {
      const hashedSecretKey = await encrypt(keypair.getSecretKey(), pin)
      await cacheSessionKey(pin, hashedSecretKey)
      unlockVaultWithKeypair(keypair)

      sendResponse({
        ok: true,
        hashedSecretKey,
        publicKeyBytes: publicKeyBytes(keypair),
      })
    } catch (error) {
      lockVault()
      sendResponse({ ok: false, error: getErrorMessage(error) })
    }
  })()

  return true
}

export function handleUnlockVault(
  message: BackgroundMessage,
  sendResponse: KeeperSendResponse,
): boolean {
  const hashedSecretKey = message.hashedSecretKey as HashedData
  const pin = message.pin as string

  ;(async () => {
    let secretKey: string
    try {
      secretKey = await decryptVaultSecret(hashedSecretKey, pin)
    } catch (error) {
      log.error('[Keeper] Decryption failed', { error: getErrorMessage(error) })
      lockVault()
      sendResponse({
        ok: false,
        error: `[Keeper] Decryption failed: ${getErrorMessage(error)}`,
      })
      return
    }

    try {
      await restoreUnlockedVault(message, secretKey, hashedSecretKey, pin)
      sendResponse({ ok: true })
    } catch (error) {
      log.error('[Keeper] Keypair creation failed', {
        error: getErrorMessage(error),
      })
      lockVault()
      sendResponse({
        ok: false,
        error: `[Keeper] Failed to create keypair: ${getErrorMessage(error)}`,
      })
    }
  })()

  return true
}

export function handleGetPublicKey(
  _message: BackgroundMessage,
  sendResponse: KeeperSendResponse,
): boolean {
  if (enforceExpiry()) {
    sendResponse({ error: 'LOCKED' })
    return false
  }

  sendResponse({ ok: true, publicKeyBytes: publicKeyBytes(getEphemeralKey()) })
  return false
}

/** Reports ms left on the unlock window (0 when locked/expired). */
export function handleGetUnlockRemaining(
  _message: BackgroundMessage,
  sendResponse: KeeperSendResponse,
): boolean {
  sendResponse({ ok: true, remainingMs: getUnlockRemainingMs() })
  return false
}

export function handleRotateKeypair(
  _message: BackgroundMessage,
  sendResponse: KeeperSendResponse,
): boolean {
  const sessionKey = getSessionKey()
  if (enforceExpiry() || !sessionKey) {
    sendResponse({
      ok: false,
      error: 'Vault must be unlocked again before rotating keypair',
    })
    return false
  }

  ;(async () => {
    try {
      const newKeypair = ZKEd25519Keypair.generate()
      const hashedSecretKey = await encryptWithKey(
        newKeypair.getSecretKey(),
        sessionKey.derivedKey,
        sessionKey.salt,
      )

      // Swap only after encryption succeeds so storage and RAM never diverge.
      keeperReplaceEphemeralKey(newKeypair)

      sendResponse({
        ok: true,
        hashedSecretKey,
        publicKeyBytes: publicKeyBytes(newKeypair),
      })
    } catch (error) {
      sendResponse({ ok: false, error: getErrorMessage(error) })
    }
  })()

  return true
}

export function handleEphSign(
  message: BackgroundMessage,
  sendResponse: KeeperSendResponse,
): boolean {
  const key = getEphemeralKey()
  if (enforceExpiry() || !key) {
    sendResponse({ error: '[KEEPER_EPH_SIGN] LOCKED' })
    return false
  }
  // Capture the current key before async work so a later lock does not mutate it.
  ;(async () => {
    try {
      const { msgBytes, scope, zkProofData } = message
      if (!zkProofData) {
        throw new Error('[KEEPER_EPH_SIGN] zkProofData is required')
      }
      // Re-applied on every sign rather than cached: applyZKProof cleanly
      // overwrites the keypair's proof state (no accumulation), so this is
      // idempotent and also picks up a fresh proof when the epoch rolls over
      // mid-session.
      key.applyZKProof(zkProofData as ZKProofData)
      const msgUint8 = new Uint8Array(msgBytes as number[])
      // We route by scope inline rather than via wallet-core's exported
      // signWithIntent: the proof is already applied to the keypair above, after
      // which signTransaction/signPersonalMessage emit the zkLogin signature
      // directly. signWithIntent would only wrap this same two-line branch.
      const result =
        scope === 'TransactionData'
          ? await key.signTransaction(msgUint8)
          : await key.signPersonalMessage(msgUint8)

      sendResponse({
        ok: true,
        bytes: result.bytes,
        userSignature: result.signature,
      })
    } catch (error) {
      sendResponse({ ok: false, error: getErrorMessage(error) })
    }
  })()

  return true
}

export function handleClearEphKey(
  _message: BackgroundMessage,
  sendResponse: KeeperSendResponse,
): boolean {
  lockVault()
  sendResponse({ ok: true })
  return false
}
