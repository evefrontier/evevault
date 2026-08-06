import { KeeperMessageTypes } from '@evevault/shared'
import { type Browser, browser } from 'wxt/browser'
import type { BackgroundMessage } from '@/lib/background/types'
import { handleKeeperMessage, type KeeperSendResponse } from './keeperHandlers'

/**
 * Keeper - Holds the ephemeral key in RAM-only memory.
 *
 * This offscreen document stays alive much longer than the service worker
 * and provides a stable place to store the decrypted ephemeral key.
 */
browser.runtime.onMessage.addListener(
  (
    message: BackgroundMessage,
    sender: Browser.runtime.MessageSender,
    sendResponse: KeeperSendResponse,
  ) => handleKeeperMessage(message, sender, sendResponse),
)

console.log('Keeper offscreen document initialized')

browser.runtime.sendMessage({ type: KeeperMessageTypes.READY }).catch(() => {
  // Ignore errors if background script isn't listening
})
