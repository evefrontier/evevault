import type {
  PersistedDeviceStore,
  PersistedDeviceStoreState,
  StoredSecretKey,
} from '@evevault/shared/types'
import { KeeperMessageTypes } from '@evevault/shared/types'
import { createLogger, DEVICE_STORAGE_KEY } from '@evevault/shared/utils'
import { browser } from 'wxt/browser'
import { ensureOffscreen } from '@/lib/background/services/offscreenService'

const log = createLogger()

/**
 * Reads ephemeralKeyPairSecretKey from Chrome storage if it's null in memory.
 * This handles the race condition where the background script's Zustand store
 * hasn't rehydrated yet when setState is called.
 */
export async function getEphemeralKeyPairSecretKeyFromStorage(): Promise<StoredSecretKey | null> {
  if (!browser?.storage) {
    return null
  }

  try {
    const result = await browser.storage.local.get([DEVICE_STORAGE_KEY])
    const stored = result[DEVICE_STORAGE_KEY] || null

    if (!stored) {
      return null
    }

    let persistedState: PersistedDeviceStoreState | null = null
    if (typeof stored === 'string') {
      persistedState =
        (JSON.parse(stored) as PersistedDeviceStore).state ?? null
    } else if (typeof stored === 'object' && 'state' in stored) {
      persistedState = (stored as PersistedDeviceStore).state ?? null
    }

    const storedKey = persistedState?.ephemeralKeyPairSecretKey
    if (
      storedKey &&
      typeof storedKey === 'object' &&
      'iv' in storedKey &&
      'data' in storedKey
    ) {
      return storedKey as StoredSecretKey
    }
  } catch (error) {
    log.warn('Failed to retrieve ephemeralKeyPairSecretKey from storage', error)
  }

  return null
}

/**
 * Checks if the keeper has an unlocked ephemeral key and returns the public key bytes if available
 */
export async function checkKeeperUnlocked(): Promise<{
  unlocked: boolean
  publicKeyBytes?: number[]
}> {
  try {
    await ensureOffscreen(true)
    const response = await browser.runtime.sendMessage({
      type: KeeperMessageTypes.GET_PUBLIC_KEY,
      target: 'KEEPER',
    })
    if (response?.ok === true && response?.publicKeyBytes) {
      return {
        unlocked: true,
        publicKeyBytes: response.publicKeyBytes,
      }
    }
    return { unlocked: false }
  } catch (error) {
    log.error('Failed to check keeper status', error)
    return { unlocked: false }
  }
}
