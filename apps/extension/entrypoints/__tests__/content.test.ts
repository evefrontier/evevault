import { VaultMessageTypes, WalletStandardMessageTypes } from '@evevault/shared'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

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

afterEach(() => {
  vi.restoreAllMocks()
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

  it('allows sponsored transaction requests with string assembly ids', () => {
    expect(
      content.isAllowedPageMessage({
        __to: 'Eve Vault',
        id: 'sponsored-id',
        action:
          WalletStandardMessageTypes.EVEFRONTIER_SIGN_SPONSORED_TRANSACTION,
        message: {
          action: 'mine',
          assembly: '1',
          assemblyType: 'type',
        },
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

    expect(
      content.isAllowedPageMessage({
        __to: 'Eve Vault',
        id: 'sponsored-id',
        action:
          WalletStandardMessageTypes.EVEFRONTIER_SIGN_SPONSORED_TRANSACTION,
        message: {
          action: 'mine',
          assembly: 1,
          assemblyType: 'type',
        },
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

  it('posts public background responses to the page origin instead of wildcard origin', () => {
    const postMessage = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined)

    content.forwardToPage({
      id: 'connect-id',
      type: 'auth_success',
      chain: 'sui:testnet',
      address: '0x123',
      publicKey: 'AQID',
    })

    expect(postMessage).toHaveBeenCalledWith(
      {
        __from: 'Eve Vault',
        id: 'connect-id',
        type: 'auth_success',
        chain: 'sui:testnet',
        address: '0x123',
        publicKey: 'AQID',
      },
      window.location.origin,
    )
  })

  it('does not forward token-bearing auth responses to the page', () => {
    const postMessage = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined)

    content.forwardToPage({
      id: 'connect-id',
      type: 'auth_success',
      token: {
        access_token: 'access-token',
        id_token: 'id-token',
        refresh_token: 'refresh-token',
      },
    })

    expect(postMessage).not.toHaveBeenCalled()
  })

  it('does not forward nested token material to the page', () => {
    const postMessage = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined)

    content.forwardToPage({
      id: 'connect-id',
      type: 'auth_success',
      chain: 'sui:testnet',
      address: '0x123',
      account: {
        id_token: 'id-token',
      },
    })

    expect(postMessage).not.toHaveBeenCalled()
  })

  it('forwards the bare web-unlock auth_success (no chain/address) to the page', () => {
    const postMessage = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined)

    content.forwardToPage({ id: 'unlock-id', type: 'auth_success' })

    expect(postMessage).toHaveBeenCalledWith(
      { __from: 'Eve Vault', id: 'unlock-id', type: 'auth_success' },
      window.location.origin,
    )
  })

  it('forwards disconnect responses to the page', () => {
    const postMessage = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined)

    content.forwardToPage({
      id: 'disconnect-id',
      type: 'disconnect_success',
    })
    content.forwardToPage({
      id: 'disconnect-id',
      type: 'disconnect_error',
      error: { message: 'revocation failed' },
    })

    expect(postMessage).toHaveBeenCalledWith(
      {
        __from: 'Eve Vault',
        id: 'disconnect-id',
        type: 'disconnect_success',
      },
      window.location.origin,
    )
    expect(postMessage).toHaveBeenCalledWith(
      {
        __from: 'Eve Vault',
        id: 'disconnect-id',
        type: 'disconnect_error',
        error: { message: 'revocation failed' },
      },
      window.location.origin,
    )
  })

  it('forces __from to "Eve Vault" even if the forwarded message sets it', () => {
    const postMessage = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined)

    content.forwardToPage({
      __from: 'attacker',
      id: 'unlock-id',
      type: 'auth_success',
    })

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ __from: 'Eve Vault' }),
      window.location.origin,
    )
  })
})
