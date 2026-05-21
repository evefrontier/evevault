import { chromeStorageAdapter } from '#/adapters/extension'
import { localStorageAdapter } from '#/adapters/web'
import { isWeb } from './environment'
import { CONTEXT_STORAGE_KEY } from './storageKeys'

function getStorage() {
  return isWeb() ? localStorageAdapter : chromeStorageAdapter
}

/** Persisted context blob shape. */
type ContextPersisted = {
  state?: { tenantId?: string; devMode?: boolean }
  version?: number
}

/**
 * Returns whether dev mode is enabled (persisted with context store in localStorage on web, chrome.storage in extension).
 */
export async function getDevModeEnabled(): Promise<boolean> {
  const raw = await getStorage().getItem(CONTEXT_STORAGE_KEY)
  if (!raw) return false
  try {
    const parsed = JSON.parse(raw) as ContextPersisted
    return parsed?.state?.devMode === true
  } catch {
    return false
  }
}
