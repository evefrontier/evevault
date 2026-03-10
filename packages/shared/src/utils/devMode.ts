import { chromeStorageAdapter } from "../adapters/extension";
import { localStorageAdapter } from "../adapters/web";
import { isWeb } from "./environment";
import { TENANT_STORAGE_KEY } from "./storageKeys";

function getStorage() {
  return isWeb() ? localStorageAdapter : chromeStorageAdapter;
}

/** Persisted tenant blob shape (matches tenant store persist). */
type TenantPersisted = {
  state?: { tenantId?: string; devMode?: boolean };
  version?: number;
};

/**
 * Returns whether dev mode is enabled (persisted with tenant store in localStorage on web, chrome.storage in extension).
 */
export async function getDevModeEnabled(): Promise<boolean> {
  const raw = await getStorage().getItem(TENANT_STORAGE_KEY);
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as TenantPersisted;
    return parsed?.state?.devMode === true;
  } catch {
    return false;
  }
}
