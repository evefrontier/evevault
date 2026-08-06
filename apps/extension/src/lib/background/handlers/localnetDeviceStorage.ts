import type { HashedData } from '@evevault/shared'
import { DEVICE_STORAGE_KEY } from '@evevault/shared/utils/storageKeys'
import { browser } from 'wxt/browser'

type DeviceStorage = {
  state?: {
    localnet?: {
      encryptedKey?: string | null
      address?: string | null
    } | null
  }
  version?: number
}

/**
 * Reads only well-formed encrypted localnet keys so corrupted storage does not
 * get passed to keeper decryption.
 */
export async function readEncryptedLocalnetKey(): Promise<HashedData | null> {
  const device = await readDeviceStorage()
  const existing = device.state?.localnet?.encryptedKey
  if (!existing) return null
  try {
    const parsed = JSON.parse(existing) as unknown
    if (isEncryptedBlob(parsed)) return parsed
  } catch {
    return null
  }
  return null
}

/**
 * Writes localnet key data through the same persisted device-store envelope so
 * keeper and UI code continue sharing one storage key.
 */
export async function writeEncryptedLocalnetKey(
  encryptedKey: HashedData,
  address: string | null,
): Promise<void> {
  const device = await readDeviceStorage()
  const updated: DeviceStorage = {
    ...device,
    state: {
      ...(device.state ?? {}),
      localnet: {
        ...(device.state?.localnet ?? {}),
        encryptedKey: JSON.stringify(encryptedKey),
        address,
      },
    },
  }

  await writeDeviceStorage(updated)
}

/**
 * Checks the encrypted blob shape explicitly because storage contents can be
 * user-edited, stale, or serialized by older extension builds.
 */
function isEncryptedBlob(value: unknown): value is HashedData {
  if (!value || typeof value !== 'object') return false

  return ['iv', 'data', 'salt'].every((key) => key in value)
}

/**
 * Normalizes missing, stringified, and already-parsed storage values because
 * Chrome storage can contain either shape during migration windows.
 */
function parseDeviceStorage(raw: unknown): DeviceStorage {
  if (!raw) return { state: {}, version: 0 }
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as DeviceStorage
    } catch {
      return { state: {}, version: 0 }
    }
  }
  if (typeof raw === 'object') {
    return raw as DeviceStorage
  }
  return { state: {}, version: 0 }
}

/**
 * Reads the complete device-store envelope so localnet updates can preserve
 * unrelated persisted device state.
 */
async function readDeviceStorage(): Promise<DeviceStorage> {
  const result = await browser.storage.local.get([DEVICE_STORAGE_KEY])
  return parseDeviceStorage(result[DEVICE_STORAGE_KEY])
}

/**
 * Persists the device envelope as JSON to match the Zustand persisted-store
 * representation used elsewhere in the extension.
 */
async function writeDeviceStorage(device: DeviceStorage): Promise<void> {
  await browser.storage.local.set({
    [DEVICE_STORAGE_KEY]: JSON.stringify(device),
  })
}
