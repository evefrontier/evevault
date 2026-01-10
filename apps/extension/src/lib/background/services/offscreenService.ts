/// <reference types="chrome"/>

import { createLogger } from "@evevault/shared/utils";

const log = createLogger();

let keeperReady = false;
const keeperReadyPromise = new Promise<void>((resolve) => {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "KEEPER_READY") {
      keeperReady = true;
      resolve();
    }
    return false;
  });
});

/**
 * Ensures the offscreen document (keeper) exists
 * @param waitForReady - If true, waits for keeper to signal readiness (with timeout)
 * @returns Promise that resolves when document is ready (or just created if waitForReady is false)
 */
export async function ensureOffscreen(waitForReady = false): Promise<void> {
  try {
    const hasDoc = await chrome.offscreen.hasDocument();
    if (!hasDoc) {
      await chrome.offscreen.createDocument({
        url: "keeper.html",
        reasons: ["LOCAL_STORAGE", "DOM_SCRAPING"],
        justification: "Hold ephemeral key in RAM only.",
      });
      log.info("Keeper offscreen document created");

      if (waitForReady) {
        // Wait for keeper to signal it's ready (with timeout)
        await Promise.race([
          keeperReadyPromise,
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Keeper initialization timeout")),
              2000,
            ),
          ),
        ]);
      }
    } else {
      log.debug("Keeper offscreen document exists");

      if (waitForReady && !keeperReady) {
        keeperReady = true;
      }
    }
  } catch (error) {
    log.error("Failed to ensure offscreen document", error);
    if (waitForReady) {
      throw error;
    }
  }
}
