import { VaultMessageTypes, WalletStandardMessageTypes } from '@evevault/shared'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

type ContentModule = typeof import('../content')

let content: ContentModule

beforeAll(async () => {
  vi.stubGlobal(
    'defineContentScript',
    vi.fn((definition) => definition),
  )
  content = await import('../content')
})

beforeEach(() => {
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: vi.fn(),
      getURL: vi.fn(
        (path: string) => `chrome-extension://extension-id/${path}`,
      ),
      onMessage: {
        addListener: vi.fn(),
      },
    },
    storage: {
      local: {
        get: vi.fn(),
      },
    },
  } as unknown as typeof chrome)
})

describe('content bridge message validation', () => {
  it('allows wallet-standard connect and signing messages', () => {
    expect(
      content.isAllowedPageMessage({
        __to: 'Eve Vault',
        type: 'connect',
        id: 'connect-id',
      }),
    ).toBe(true)

    expect(
      content.isAllowedPageMessage({
        __to: 'Eve Vault',
        id: 'sign-id',
        action: WalletStandardMessageTypes.SIGN_TRANSACTION,
        transaction: 'tx-json',
        account: { address: '0xabc' },
      }),
    ).toBe(true)
  })

  it('rejects vault and malformed wallet messages from the page', () => {
    expect(
      content.isAllowedPageMessage({
        __to: 'Eve Vault',
        type: VaultMessageTypes.UNLOCK_VAULT,
        pin: '123456',
      }),
    ).toBe(false)

    expect(
      content.isAllowedPageMessage({
        __to: 'Eve Vault',
        action: WalletStandardMessageTypes.SIGN_TRANSACTION,
        transaction: 'tx-json',
      }),
    ).toBe(false)

    expect(
      content.isAllowedPageMessage({
        type: 'connect',
        id: 'connect-id',
      }),
    ).toBe(false)
  })

  it('only forwards allowed same-origin page messages to background', () => {
    const allowed = new MessageEvent('message', {
      data: {
        __to: 'Eve Vault',
        type: 'connect',
        id: 'connect-id',
      },
      origin: window.location.origin,
      source: window,
    })
    const blocked = new MessageEvent('message', {
      data: {
        __to: 'Eve Vault',
        type: VaultMessageTypes.UNLOCK_VAULT,
        pin: '123456',
      },
      origin: window.location.origin,
      source: window,
    })

    content.handleWindowMessage(blocked)
    content.handleWindowMessage(allowed)

    expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1)
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(allowed.data)
  })

  it('posts background responses to the page origin instead of wildcard origin', () => {
    const postMessage = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined)

    content.forwardToPage({ id: 'connect-id', type: 'auth_success' })

    expect(postMessage).toHaveBeenCalledWith(
      {
        __from: 'Eve Vault',
        id: 'connect-id',
        type: 'auth_success',
      },
      window.location.origin,
    )
  })
})
