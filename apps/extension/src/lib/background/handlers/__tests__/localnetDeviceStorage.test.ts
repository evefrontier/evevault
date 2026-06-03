import { DEVICE_STORAGE_KEY } from '@evevault/shared/utils/storageKeys'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  readEncryptedLocalnetKey,
  writeEncryptedLocalnetKey,
} from '@/lib/background/handlers/localnetDeviceStorage'

const encryptedKey = { iv: 'iv', data: 'data', salt: 'salt' }

function installChromeStorageMock(initialValue: unknown) {
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({ [DEVICE_STORAGE_KEY]: initialValue }),
        set: vi.fn().mockResolvedValue(undefined),
      },
    },
  } as unknown as typeof chrome)
}

describe('localnetDeviceStorage', () => {
  beforeEach(() => {
    installChromeStorageMock(undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('reads a valid encrypted localnet key from serialized device storage', async () => {
    installChromeStorageMock(
      JSON.stringify({
        state: {
          localnet: {
            encryptedKey: JSON.stringify(encryptedKey),
          },
        },
        version: 0,
      }),
    )

    await expect(readEncryptedLocalnetKey()).resolves.toEqual(encryptedKey)
  })

  it('reads a valid encrypted localnet key from object device storage', async () => {
    installChromeStorageMock({
      state: {
        localnet: {
          encryptedKey: JSON.stringify(encryptedKey),
        },
      },
      version: 0,
    })

    await expect(readEncryptedLocalnetKey()).resolves.toEqual(encryptedKey)
  })

  it.each([
    ['empty storage', undefined],
    ['invalid device storage JSON', '{not-json'],
    ['missing encryptedKey', JSON.stringify({ state: { localnet: {} } })],
    [
      'invalid encryptedKey JSON',
      JSON.stringify({ state: { localnet: { encryptedKey: '{not-json' } } }),
    ],
    [
      'encryptedKey missing salt',
      JSON.stringify({
        state: {
          localnet: {
            encryptedKey: JSON.stringify({ iv: 'iv', data: 'data' }),
          },
        },
      }),
    ],
  ])('returns null for %s', async (_label, storedValue) => {
    installChromeStorageMock(storedValue)

    await expect(readEncryptedLocalnetKey()).resolves.toBeNull()
  })

  it('writes encrypted localnet key while preserving existing state fields', async () => {
    installChromeStorageMock({
      state: {
        anotherField: 'preserved',
        localnet: {
          address: '0xold',
          otherLocalnetField: 'also-preserved',
        },
      },
      version: 2,
    })

    await writeEncryptedLocalnetKey(encryptedKey, '0xnew')

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      [DEVICE_STORAGE_KEY]: JSON.stringify({
        state: {
          anotherField: 'preserved',
          localnet: {
            address: '0xnew',
            otherLocalnetField: 'also-preserved',
            encryptedKey: JSON.stringify(encryptedKey),
          },
        },
        version: 2,
      }),
    })
  })
})
