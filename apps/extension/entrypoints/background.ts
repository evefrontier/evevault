/// <reference types="vite/client" />

import { browser } from 'wxt/browser'
import { handleMessage } from '../src/lib/background/handlers/messageHandler'
import { handlePortConnection } from '../src/lib/background/handlers/portHandlers'
import { ensureOffscreen } from '../src/lib/background/services/offscreenService'

// @ts-expect-error
export default defineBackground(() => {
  // Ensure keeper offscreen document exists on startup (don't wait for ready)
  ensureOffscreen(false)

  // Set up message handling
  browser.runtime.onMessage.addListener(handleMessage)

  // Set up port connections
  browser.runtime.onConnect.addListener(handlePortConnection)
})
