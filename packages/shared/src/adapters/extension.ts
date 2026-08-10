import { browser } from '@wxt-dev/browser'
import type { StorageAdapter } from '#/types'

// Extension storage adapter (chrome.storage.local via the browser polyfill)
export const chromeStorageAdapter: StorageAdapter = {
  getItem: async (name: string): Promise<string | null> => {
    if (!browser?.storage) {
      return null
    }
    const result = await browser.storage.local.get(name)
    const value = result[name]
    return typeof value === 'string' ? value : null
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (!browser?.storage) {
      return
    }
    await browser.storage.local.set({ [name]: value })
  },
  removeItem: async (name: string): Promise<void> => {
    if (!browser?.storage) {
      return
    }
    await browser.storage.local.remove(name)
  },
}
