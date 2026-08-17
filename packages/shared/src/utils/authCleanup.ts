import { browser } from '@wxt-dev/browser'
import { createLogger } from './logger'

const log = createLogger()

export function cleanupOidcStorage(): void {
  // Get all keys from localStorage
  const keysToRemove: string[] = []

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)

    // Check if the key is related to OIDC
    if (key?.startsWith('evevault.oidc')) {
      keysToRemove.push(key)
    }
  }

  // Remove all identified keys
  log.info('Cleaning up OIDC entries from localStorage', {
    total: keysToRemove.length,
  })
  keysToRemove.forEach((key) => {
    log.debug('Removing localStorage key', { key })
    localStorage.removeItem(key)
  })
}

/**
 * Cleans up all OIDC-related data from chrome.storage.local (for extensions)
 */
export async function cleanupExtensionStorage(): Promise<void> {
  if (!browser?.storage) {
    return
  }

  // null returns all keys (browser.storage.local.get accepts null)
  const items = await browser.storage.local.get(null)
  const keysToRemove: string[] = []

  // Check all keys in browser.storage.local
  for (const key in items) {
    if (key.includes('oidc') || key.includes('eve')) {
      keysToRemove.push(key)
    }
  }

  log.info('Cleaning up OIDC entries from browser.storage.local', {
    total: keysToRemove.length,
  })
  if (keysToRemove.length > 0) {
    await browser.storage.local.remove(keysToRemove)
    log.info('Extension storage cleanup complete')
  }
}

/**
 * Performs a complete cleanup of all OIDC-related storage
 */
export async function performFullCleanup(): Promise<void> {
  cleanupOidcStorage()
  log.info('OIDC storage cleanup complete')
}
