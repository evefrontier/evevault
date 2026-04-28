/// <reference types="chrome"/>

import { KeeperMessageTypes, LOCALNET_STORAGE_KEY } from "@evevault/shared";
import { createLogger } from "@evevault/shared/utils";

const log = createLogger();

function restoreLocalnetKeyToKeeper(): void {
  chrome.storage.local.get(LOCALNET_STORAGE_KEY, (result) => {
    const raw = result[LOCALNET_STORAGE_KEY] as string | undefined;
    if (!raw) return;
    const msg = {
      type: KeeperMessageTypes.LOCALNET_SET_KEYPAIR,
      privateKey: raw,
      target: "KEEPER",
    };
    chrome.runtime.sendMessage(msg, (response) => {
      if (chrome.runtime.lastError) {
        log.warn(
          "Failed to restore localnet key to keeper",
          chrome.runtime.lastError.message,
        );
        return;
      }
      if (response?.ok) {
        log.info("Keeper: restored localnet keypair", response.address);
        return;
      }

      const restoreError =
        typeof response?.error === "string"
          ? response.error
          : "Keeper rejected stored localnet key";

      log.warn("Failed to restore localnet key to keeper", restoreError);

      chrome.storage.local.remove(LOCALNET_STORAGE_KEY, () => {
        if (chrome.runtime.lastError) {
          log.warn(
            "Failed to remove invalid localnet key from storage",
            chrome.runtime.lastError.message,
          );
          return;
        }
        log.info("Removed invalid localnet key from storage");
      });
    });
  });
}

let keeperReady = false;
const keeperReadyPromise = new Promise<void>((resolve) => {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "KEEPER_READY") {
      keeperReady = true;
      restoreLocalnetKeyToKeeper();
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
