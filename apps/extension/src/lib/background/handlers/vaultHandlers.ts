import { createLogger, KeeperMessageTypes } from '@evevault/shared'
import type { Browser } from 'wxt/browser'
import { keeperHost } from '@/lib/background/keeper/keeperHost'
import type { VaultMessage } from '@/lib/background/types'
import { checkPendingAuthAfterUnlock } from './authHandlers'
import { readEncryptedLocalnetKey } from './localnetDeviceStorage'

export {
  _handleLocalnetGetAddress,
  _handleLocalnetSetKeypair,
  _handleLocalnetSignBytes,
} from './localVaultHandlers'

const log = createLogger()

/**
 * Sends a message to the keeper and returns the response.
 * Delegates transport (offscreen lifecycle + retries) to the KeeperHost seam.
 */
// biome-ignore lint/suspicious/noExplicitAny: Keeper messages have dynamic types
export async function sendToKeeper(message: any, retries = 3): Promise<any> {
  return keeperHost.send(message, retries)
}

// Higher-level wrapper over sendToKeeper: maps the keeper response to a
// sendResponse payload and catches errors. sendToKeeper handles transport
// (retries, offscreen); this handles the handler contract (ok/error shape).
async function forwardToKeeper(
  sendResponse: (r?: unknown) => void,
  message: Record<string, unknown>,
  mapResponse: (r: Record<string, unknown>) => unknown,
): Promise<boolean> {
  try {
    sendResponse(mapResponse((await sendToKeeper(message)) ?? {}))
  } catch (error) {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
  return true
}

/**
 * Handles UNLOCK_VAULT message - decrypts and loads the ephemeral key into keeper
 */
export async function handleUnlockVault(
  message: VaultMessage,
  _sender: Browser.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): Promise<boolean | undefined> {
  const { hashedSecretKey, pin } = message

  // Validate that we have a key to decrypt
  if (!hashedSecretKey) {
    sendResponse({
      ok: false,
      error:
        'No secret key provided. Cannot unlock vault without an existing key. Create a new key pair first.',
    })
    return true
  }

  try {
    // Read the encrypted localnet key (if any) so keeper can restore it during unlock.
    const encryptedLocalnetKey = await readEncryptedLocalnetKey()

    const keeperResponse = await sendToKeeper({
      type: KeeperMessageTypes.UNLOCK_VAULT,
      hashedSecretKey: hashedSecretKey,
      pin,
      encryptedLocalnetKey,
    })

    log.debug('[VaultHandler] Keeper response:', keeperResponse)

    if (keeperResponse?.ok) {
      sendResponse({ ok: true })
      checkPendingAuthAfterUnlock()
    } else {
      const errorMessage = keeperResponse?.error || 'Failed to unlock vault'
      log.error('[VaultHandler] Unlock failed:', errorMessage)
      sendResponse({
        ok: false,
        error: errorMessage,
      })
    }

    return true
  } catch (error) {
    log.error('[VaultHandler] Error decrypting secret key:', error)
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * Handles LOCK message - locks the vault and clears the ephemeral key and zkProofs
 */
export function handleLock(
  _message: VaultMessage,
  _sender: Browser.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): Promise<boolean> {
  return forwardToKeeper(
    sendResponse,
    { type: KeeperMessageTypes.CLEAR_EPHKEY },
    (r) =>
      r?.ok
        ? { ok: true }
        : { ok: false, error: r?.error || 'Failed to lock vault' },
  )
}

export function _handleCreateKeypair(
  message: VaultMessage,
  _sender: Browser.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): Promise<boolean> {
  const { pin } = message
  return forwardToKeeper(
    sendResponse,
    { type: KeeperMessageTypes.CREATE_KEYPAIR, pin },
    (r) =>
      r?.ok
        ? {
            ok: true,
            hashedSecretKey: r.hashedSecretKey,
            publicKeyBytes: r.publicKeyBytes,
          }
        : { ok: false, error: r?.error || 'Failed to set key in keeper' },
  )
}

export function _handleRotateKeypair(
  _message: VaultMessage,
  _sender: Browser.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): Promise<boolean> {
  return forwardToKeeper(
    sendResponse,
    { type: KeeperMessageTypes.ROTATE_KEYPAIR },
    (r) =>
      r?.ok
        ? {
            ok: true,
            hashedSecretKey: r.hashedSecretKey,
            publicKeyBytes: r.publicKeyBytes,
          }
        : {
            ok: false,
            error:
              r?.error ||
              'Vault must be unlocked again before rotating keypair',
          },
  )
}

/**
 * Handles GET_PUBLIC_KEY message - returns the current ephemeral public key from keeper
 */
export function _handleGetPublicKey(
  _message: VaultMessage,
  _sender: Browser.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): Promise<boolean> {
  return forwardToKeeper(
    sendResponse,
    { type: KeeperMessageTypes.GET_PUBLIC_KEY },
    (r) =>
      r?.ok && r?.publicKeyBytes
        ? { ok: true, publicKeyBytes: r.publicKeyBytes }
        : { ok: false, error: r?.error || 'EVE Vault is LOCKED' },
  )
}

/**
 * Returns ms left on the keeper's unlock window (used by useVaultAutoLock).
 */
export function _handleGetUnlockRemaining(
  _message: VaultMessage,
  _sender: Browser.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): Promise<boolean> {
  return forwardToKeeper(
    sendResponse,
    { type: KeeperMessageTypes.GET_UNLOCK_REMAINING },
    (r) => ({ ok: true, remainingMs: r?.ok ? (r.remainingMs ?? 0) : 0 }),
  )
}

export function _handleZkEphSignBytes(
  message: VaultMessage,
  _sender: Browser.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): Promise<boolean> {
  const { msgBytes, scope, zkProofData } = message
  return forwardToKeeper(
    sendResponse,
    {
      type: KeeperMessageTypes.EPH_SIGN,
      msgBytes: Array.isArray(msgBytes)
        ? msgBytes
        : Array.from(
            msgBytes instanceof Uint8Array
              ? msgBytes
              : Object.values(msgBytes as Record<number, number>),
          ),
      scope,
      zkProofData,
    },
    (r) =>
      r?.ok && r?.bytes && r?.userSignature
        ? { ok: true, bytes: r.bytes, userSignature: r.userSignature }
        : {
            ok: false,
            error: r?.error || '[VaultHandler] Failed to sign bytes',
          },
  )
}

/**
 * Handles SET_ZKPROOF message - stores zkProof in keeper for a specific chain
 */
export function _handleSetZkProof(
  message: VaultMessage,
  _sender: Browser.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): Promise<boolean> {
  const { chain, zkProof } = message
  return forwardToKeeper(
    sendResponse,
    { type: 'KEEPER_SET_ZKPROOF', chain, zkProof },
    (r) =>
      r?.ok
        ? { ok: true }
        : { ok: false, error: r?.error || 'Failed to set zkProof in keeper' },
  )
}

/**
 * Handles GET_ZKPROOF message - retrieves zkProof from keeper for a specific chain
 */
export function _handleGetZkProof(
  message: VaultMessage,
  _sender: Browser.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): Promise<boolean> {
  const { chain } = message
  return forwardToKeeper(
    sendResponse,
    { type: KeeperMessageTypes.GET_ZKPROOF, chain },
    (r) =>
      r?.ok
        ? { ok: true, zkProof: r.zkProof }
        : {
            ok: false,
            error: r?.error || 'Failed to get zkProof from keeper',
            zkProof: null,
          },
  )
}

/**
 * Handles CLEAR_ZKPROOF message - clears zkProofs from keeper
 */
export function _handleClearZkProof(
  _message: VaultMessage,
  _sender: Browser.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): Promise<boolean> {
  return forwardToKeeper(
    sendResponse,
    { type: KeeperMessageTypes.CLEAR_ZKPROOF },
    (r) =>
      r?.ok
        ? { ok: true, zkProof: r.zkProof }
        : {
            ok: false,
            error: r?.error || 'Failed to get zkProof from keeper',
            zkProof: null,
          },
  )
}
