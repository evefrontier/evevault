/// <reference types="chrome"/>
/// <reference types="vite/client" />

import { handleMessage } from "../src/lib/background/handlers/messageHandler";
import { handlePortConnection } from "../src/lib/background/handlers/portHandlers";
import { ensureOffscreen } from "../src/lib/background/services/offscreenService";

// @ts-expect-error
export default defineBackground(() => {
  // Ensure keeper offscreen document exists on startup (don't wait for ready)
  ensureOffscreen(false);

  // Set up message handling
  chrome.runtime.onMessage.addListener(handleMessage);

  // Set up port connections
  chrome.runtime.onConnect.addListener(handlePortConnection);
});
