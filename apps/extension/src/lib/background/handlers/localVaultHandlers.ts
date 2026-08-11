import { KeeperMessageTypes } from '@evevault/shared/types'

import type { Browser } from 'wxt/browser'
import type { VaultMessage } from '@/lib/background/types'
import { writeEncryptedLocalnetKey } from './localnetDeviceStorage'
import { sendToKeeper } from './vaultHandlers'

// ─── Localnet dev signing ────────────────────────────────────────────────────

export function _handleLocalnetSetKeypair(
  message: VaultMessage,
  _sender: Browser.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean {
  ;(async () => {
    try {
      const response = await sendToKeeper({
        type: KeeperMessageTypes.LOCALNET_SET_KEYPAIR,
        privateKey: message.privateKey,
      })

      // Persist encrypted key in chrome.storage.local
      if (response?.ok && response.encryptedKey) {
        await writeEncryptedLocalnetKey(
          response.encryptedKey,
          response.address ?? null,
        )
      }
      // Forward { ok, address } but not encryptedKey to the popup
      sendResponse({
        ok: response?.ok,
        address: response?.address,
        error: response?.error,
      })
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })()
  return true
}

export async function _handleLocalnetGetAddress(
  _message: VaultMessage,
  _sender: Browser.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): Promise<boolean> {
  try {
    const response = await sendToKeeper({
      type: KeeperMessageTypes.LOCALNET_GET_ADDRESS,
    })
    sendResponse(response)
  } catch {
    sendResponse({ ok: false, address: null })
  }
  return true
}

export async function _handleLocalnetSignBytes(
  message: VaultMessage,
  _sender: Browser.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): Promise<boolean> {
  const { msgBytes, scope } = message

  try {
    const response = await sendToKeeper({
      type: KeeperMessageTypes.LOCALNET_SIGN,
      msgBytes: Array.isArray(msgBytes)
        ? msgBytes
        : Array.from(
            msgBytes instanceof Uint8Array
              ? msgBytes
              : Object.values(msgBytes as Record<number, number>),
          ),
      scope,
    })

    if (response?.ok && response?.bytes && response?.signature) {
      sendResponse({
        ok: true,
        bytes: response.bytes,
        signature: response.signature,
      })
    } else {
      sendResponse({
        ok: false,
        error: response?.error ?? 'localnet sign failed',
      })
    }
  } catch (error) {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
  return true
}
