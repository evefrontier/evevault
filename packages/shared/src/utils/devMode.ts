import { chromeStorageAdapter } from "../adapters/extension";
import { localStorageAdapter } from "../adapters/web";
import { isWeb } from "./environment";
import { NETWORK_STORAGE_KEY } from "./storageKeys";

function getStorage() {
  return isWeb() ? localStorageAdapter : chromeStorageAdapter;
}

/** Persisted network blob shape (matches network store persist). */
type NetworkPersisted = {
  state?: { chain?: string; devMode?: boolean };
  version?: number;
};

/**
 * Returns whether dev mode is enabled (persisted with network store in localStorage on web, chrome.storage in extension).
 */
export async function getDevModeEnabled(): Promise<boolean> {
  const raw = await getStorage().getItem(NETWORK_STORAGE_KEY);
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as NetworkPersisted;
    return parsed?.state?.devMode === true;
  } catch {
    return false;
  }
}
