/// <reference types="vite/client" />

import { browser } from 'wxt/browser'
import { handleMessage } from '../src/lib/background/handlers/messageHandler'
import { handlePortConnection } from '../src/lib/background/handlers/portHandlers'
import { keeperHost } from '../src/lib/background/keeper/keeperHost'

// @ts-expect-error
export default defineBackground(() => {
  // Warm up the keeper on startup (don't wait for ready)
  keeperHost.ensureReady(false)

  // Set up message handling
  browser.runtime.onMessage.addListener(handleMessage)

  // Set up port connections
  browser.runtime.onConnect.addListener(handlePortConnection)
})
