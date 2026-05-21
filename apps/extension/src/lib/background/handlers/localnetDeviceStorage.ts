import type { HashedData } from '@evevault/shared';
import { DEVICE_STORAGE_KEY } from '@evevault/shared/utils/storageKeys';

type DeviceStorage = {
  state?: {
    localnet?: {
      encryptedKey?: string | null;
      address?: string | null;
    } | null;
  };
  version?: number;
};

function isEncryptedBlob(value: unknown): value is HashedData {
  return (
    !!value &&
    typeof value === 'object' &&
    'iv' in value &&
    'data' in value &&
    'salt' in value
  );
}

function parseDeviceStorage(raw: unknown): DeviceStorage {
  if (!raw) return { state: {}, version: 0 };
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as DeviceStorage;
    } catch {
      return { state: {}, version: 0 };
    }
  }
  if (typeof raw === 'object') {
    return raw as DeviceStorage;
  }
  return { state: {}, version: 0 };
}

async function readDeviceStorage(): Promise<DeviceStorage> {
  const result = await chrome.storage.local.get([DEVICE_STORAGE_KEY]);
  return parseDeviceStorage(result[DEVICE_STORAGE_KEY]);
}

async function writeDeviceStorage(device: DeviceStorage): Promise<void> {
  await chrome.storage.local.set({
    [DEVICE_STORAGE_KEY]: JSON.stringify(device),
  });
}

export async function readEncryptedLocalnetKey(): Promise<HashedData | null> {
  const device = await readDeviceStorage();
  const existing = device.state?.localnet?.encryptedKey;
  if (!existing) return null;
  try {
    const parsed = JSON.parse(existing) as unknown;
    if (isEncryptedBlob(parsed)) return parsed;
  } catch {
    return null;
  }
  return null;
}

export async function writeEncryptedLocalnetKey(
  encryptedKey: HashedData,
  address: string | null,
): Promise<void> {
  const device = await readDeviceStorage();
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
  };

  await writeDeviceStorage(updated);
}
