import { DAPP_PERMISSIONS_STORAGE_KEY } from '@evevault/shared/utils'
import { SUI_DEVNET_CHAIN, SUI_TESTNET_CHAIN } from '@mysten/wallet-standard'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getDappRequestContext,
  grantDappPermission,
  requireDappPermission,
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
})
