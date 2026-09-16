import { createLogger } from '@evevault/shared/utils'

const log = createLogger()

/**
 * Requests persistent storage so the browser won't evict this origin's
 * IndexedDB, which holds the web vault keypair + PIN verifier. Best-effort and
 * at the browser's discretion, lowering eviction frequency rather than
 * guaranteeing durability.
 */
export const requestPersistentStorage = async (): Promise<boolean> => {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
    return false
  }

  try {
    if (await navigator.storage.persisted()) {
      return true
    }
    const granted = await navigator.storage.persist()
    log.info(
      `[storage] Persistent storage ${granted ? 'granted' : 'not granted'}`,
    )
    return granted
  } catch (error) {
    log.warn('[storage] Failed to request persistent storage', error)
    return false
  }
}
