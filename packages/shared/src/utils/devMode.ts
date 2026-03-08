import { chromeStorageAdapter } from "../adapters/extension";
import { localStorageAdapter } from "../adapters/web";
import { isWeb } from "./environment";
import { DEV_MODE_STORAGE_KEY } from "./storageKeys";

function getStorage() {
  return isWeb() ? localStorageAdapter : chromeStorageAdapter;
}

/**
 * Returns whether dev mode is enabled (persisted in localStorage on web, chrome.storage in extension).
 */
export async function getDevModeEnabled(): Promise<boolean> {
  const raw = await getStorage().getItem(DEV_MODE_STORAGE_KEY);
  return raw === "true";
}

/**
 * Persists dev mode on/off so the toggle survives refresh.
 */
export async function setDevModeEnabled(value: boolean): Promise<void> {
  await getStorage().setItem(DEV_MODE_STORAGE_KEY, value ? "true" : "false");
}
