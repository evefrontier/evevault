import { createLogger } from "./logger";

const log = createLogger();

export function cleanupOidcStorage(): void {
  // Get all keys from localStorage
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);

    // Check if the key is related to OIDC
    if (key?.startsWith("evevault.oidc")) {
      keysToRemove.push(key);
    }
  }

  // Remove all identified keys
  log.info("Cleaning up OIDC entries from localStorage", {
    total: keysToRemove.length,
  });
  keysToRemove.forEach((key) => {
    log.debug("Removing localStorage key", { key });
    localStorage.removeItem(key);
  });
}

/**
 * Cleans up all OIDC-related data from chrome.storage.local (for extensions)
 */
export function cleanupExtensionStorage(): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.storage) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    // Cast null to get all keys (Chrome API accepts null but TS types don't)
    chrome.storage.local.get(null as unknown as string[], (items) => {
      const keysToRemove: string[] = [];

      // Check all keys in chrome.storage.local
      for (const key in items) {
        if (key.includes("oidc") || key.includes("eve")) {
          keysToRemove.push(key);
        }
      }

      // Remove all identified keys
      log.info("Cleaning up OIDC entries from chrome.storage.local", {
        total: keysToRemove.length,
      });
      if (keysToRemove.length > 0) {
        chrome.storage.local.remove(keysToRemove, () => {
          log.info("Chrome storage cleanup complete");
          resolve();
        });
      } else {
        resolve();
      }
    });
  });
}

/**
 * Performs a complete cleanup of all OIDC-related storage
 */
export async function performFullCleanup(): Promise<void> {
  cleanupOidcStorage();
  log.info("OIDC storage cleanup complete");
}
