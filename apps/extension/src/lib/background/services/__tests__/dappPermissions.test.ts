import { DAPP_PERMISSIONS_STORAGE_KEY } from '@evevault/shared/utils'
import { SUI_DEVNET_CHAIN, SUI_TESTNET_CHAIN } from '@mysten/wallet-standard'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getDappRequestContext,
  grantDappPermission,
  requireDappPermission,
  revokeDappPermission,
} from '../dappPermissions'

describe('dappPermissions', () => {
  let storage: Record<string, unknown>

  beforeEach(() => {
    storage = {}
    globalThis.chrome = {
      storage: {
        local: {
          get: vi.fn(async (key: string | string[]) => {
            const keys = Array.isArray(key) ? key : [key]
            return Object.fromEntries(keys.map((item) => [item, storage[item]]))
          }),
          set: vi.fn(async (values: Record<string, unknown>) => {
            Object.assign(storage, values)
          }),
        },
      },
    } as unknown as typeof chrome
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('extracts web origin context from the sender', () => {
    const context = getDappRequestContext({
      origin: 'https://app.example',
      url: 'https://app.example/dashboard?tab=wallet',
      tab: {
        title: 'Example App',
        favIconUrl: 'https://app.example/favicon.ico',
      },
    } as chrome.runtime.MessageSender)

    expect(context).toEqual({
      origin: 'https://app.example',
      url: 'https://app.example/dashboard?tab=wallet',
      title: 'Example App',
      favIconUrl: 'https://app.example/favicon.ico',
    })
  })

  it('rejects non-web senders', () => {
    const context = getDappRequestContext({
      origin: 'chrome-extension://extension-id',
      url: 'chrome-extension://extension-id/page.html',
    } as chrome.runtime.MessageSender)

    expect(context).toBeNull()
  })

  it('grants and requires a permission for the same origin and chain', async () => {
    const context = {
      origin: 'https://app.example',
      url: 'https://app.example/play',
    }

    await grantDappPermission(context, SUI_TESTNET_CHAIN)

    await expect(
      requireDappPermission(
        {
          origin: 'https://app.example',
          url: 'https://app.example/inventory',
        } as chrome.runtime.MessageSender,
        SUI_TESTNET_CHAIN,
      ),
    ).resolves.toMatchObject({
      allowed: true,
      context: {
        origin: 'https://app.example',
        url: 'https://app.example/inventory',
      },
    })

    expect(storage[DAPP_PERMISSIONS_STORAGE_KEY]).toMatchObject({
      'https://app.example': {
        origin: 'https://app.example',
        chains: [SUI_TESTNET_CHAIN],
      },
    })
  })

  it('merges chain grants without replacing the original connected time', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1000)
    await grantDappPermission(
      { origin: 'https://app.example' },
      SUI_TESTNET_CHAIN,
    )

    vi.setSystemTime(2000)
    await grantDappPermission(
      { origin: 'https://app.example' },
      SUI_DEVNET_CHAIN,
    )

    expect(storage[DAPP_PERMISSIONS_STORAGE_KEY]).toMatchObject({
      'https://app.example': {
        connectedAt: 1000,
        updatedAt: 2000,
        chains: [SUI_TESTNET_CHAIN, SUI_DEVNET_CHAIN],
      },
    })
  })

  it('preserves unrelated origins when revoking one permission', async () => {
    await grantDappPermission(
      { origin: 'https://app.example' },
      SUI_TESTNET_CHAIN,
    )
    await grantDappPermission(
      { origin: 'https://other.example' },
      SUI_DEVNET_CHAIN,
    )

    await revokeDappPermission({
      origin: 'https://app.example',
    } as chrome.runtime.MessageSender)

    expect(storage[DAPP_PERMISSIONS_STORAGE_KEY]).toMatchObject({
      'https://other.example': {
        origin: 'https://other.example',
        chains: [SUI_DEVNET_CHAIN],
      },
    })
    expect(
      (storage[DAPP_PERMISSIONS_STORAGE_KEY] as Record<string, unknown>)[
        'https://app.example'
      ],
    ).toBeUndefined()
  })

  it('cleans malformed entries when updating the permission store', async () => {
    storage[DAPP_PERMISSIONS_STORAGE_KEY] = {
      'https://broken.example': {
        origin: 'https://broken.example',
        chains: ['sui:testnet'],
      },
    }

    await grantDappPermission(
      { origin: 'https://app.example' },
      SUI_TESTNET_CHAIN,
    )

    expect(storage[DAPP_PERMISSIONS_STORAGE_KEY]).toMatchObject({
      'https://app.example': {
        origin: 'https://app.example',
        chains: [SUI_TESTNET_CHAIN],
      },
    })
    expect(
      (storage[DAPP_PERMISSIONS_STORAGE_KEY] as Record<string, unknown>)[
        'https://broken.example'
      ],
    ).toBeUndefined()
  })

  it('serializes concurrent grants so updates do not overwrite each other', async () => {
    await Promise.all([
      grantDappPermission({ origin: 'https://app.example' }, SUI_TESTNET_CHAIN),
      grantDappPermission(
        { origin: 'https://other.example' },
        SUI_DEVNET_CHAIN,
      ),
    ])

    expect(storage[DAPP_PERMISSIONS_STORAGE_KEY]).toMatchObject({
      'https://app.example': {
        origin: 'https://app.example',
        chains: [SUI_TESTNET_CHAIN],
      },
      'https://other.example': {
        origin: 'https://other.example',
        chains: [SUI_DEVNET_CHAIN],
      },
    })
  })

  it('denies an origin that has not connected', async () => {
    await expect(
      requireDappPermission({
        origin: 'https://unknown.example',
      } as chrome.runtime.MessageSender),
    ).resolves.toEqual({
      allowed: false,
      context: { origin: 'https://unknown.example' },
      error: 'Connect this site to EVE Vault before requesting a signature.',
    })
  })

  it('denies a connected origin on a chain it has not connected to', async () => {
    await grantDappPermission(
      { origin: 'https://app.example' },
      SUI_TESTNET_CHAIN,
    )

    await expect(
      requireDappPermission(
        { origin: 'https://app.example' } as chrome.runtime.MessageSender,
        SUI_DEVNET_CHAIN,
      ),
    ).resolves.toEqual({
      allowed: false,
      context: { origin: 'https://app.example' },
      error: 'Connect this site on the selected network before signing.',
    })
  })

  it('revokes a permission for the sender origin', async () => {
    await grantDappPermission(
      { origin: 'https://app.example' },
      SUI_TESTNET_CHAIN,
    )

    await expect(
      revokeDappPermission({
        origin: 'https://app.example',
      } as chrome.runtime.MessageSender),
    ).resolves.toEqual({
      ok: true,
      context: { origin: 'https://app.example' },
      hadPermission: true,
    })

    expect(storage[DAPP_PERMISSIONS_STORAGE_KEY]).toEqual({})
    await expect(
      requireDappPermission({
        origin: 'https://app.example',
      } as chrome.runtime.MessageSender),
    ).resolves.toMatchObject({
      allowed: false,
      error: 'Connect this site to EVE Vault before requesting a signature.',
    })
  })

  it('treats revocation without a stored permission as success', async () => {
    await expect(
      revokeDappPermission({
        origin: 'https://app.example',
      } as chrome.runtime.MessageSender),
    ).resolves.toEqual({
      ok: true,
      context: { origin: 'https://app.example' },
      hadPermission: false,
    })
  })

  it('rejects revocation from non-web senders', async () => {
    await expect(
      revokeDappPermission({
        origin: 'chrome-extension://extension-id',
      } as chrome.runtime.MessageSender),
    ).resolves.toEqual({
      ok: false,
      error: 'Disconnect requests must come from a valid web page origin.',
    })
  })
})
