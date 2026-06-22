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
      { __from: 'Eve Vault', id: 'unlock-id', type: 'auth_success' },
      window.location.origin,
    )
  })

  it('allows disconnect messages from the page', () => {
    expect(
      content.isAllowedPageMessage({
        __to: 'Eve Vault',
        type: 'disconnect',
        id: 'disconnect-id',
      }),
    ).toBe(true)
  })

  it('rejects disconnect messages with an invalid id', () => {
    expect(
      content.isAllowedPageMessage({
        __to: 'Eve Vault',
        type: 'disconnect',
        id: '',
      }),
    ).toBe(false)
  })

  it('rejects a personal message request without an account', () => {
    expect(
      content.isAllowedPageMessage({
        __to: 'Eve Vault',
        id: 'pm-id',
        action: WalletStandardMessageTypes.SIGN_PERSONAL_MESSAGE,
        message: 'hello',
      }),
    ).toBe(false)
  })

  it('allows a personal message request with a valid account', () => {
    expect(
      content.isAllowedPageMessage({
        __to: 'Eve Vault',
        id: 'pm-id',
        action: WalletStandardMessageTypes.SIGN_PERSONAL_MESSAGE,
        message: 'hello',
        account: { address: '0xabc' },
      }),
    ).toBe(true)
  })

  it('rejects messages from cross-origin sources', () => {
    const crossOrigin = new MessageEvent('message', {
      data: { __to: 'Eve Vault', type: 'connect', id: 'connect-id' },
      origin: 'https://evil.example',
      source: window,
    })

    content.handleWindowMessage(crossOrigin)

    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled()
  })

  it('ignores messages that originated from the extension itself (__from guard)', () => {
    const reflected = new MessageEvent('message', {
      data: { __from: 'Eve Vault', type: 'auth_success', id: 'x' },
      origin: window.location.origin,
      source: window,
    })

    content.handleWindowMessage(reflected)

    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled()
  })

  it('responds to get_current_chain by posting a change event to the page', async () => {
    const postMessage = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined)
    ;(chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(
      (_keys: unknown, callback: (result: Record<string, unknown>) => void) => {
        callback({
          'evevault:context': JSON.stringify({
            state: { chain: 'sui:mainnet' },
          }),
        })
      },
    )

    const event = new MessageEvent('message', {
      data: { __to: 'Eve Vault', type: 'get_current_chain' },
      origin: window.location.origin,
      source: window,
    })

    content.handleWindowMessage(event)

    await new Promise((r) => setTimeout(r, 0))

    expect(postMessage).toHaveBeenCalledWith(
      {
        __from: 'Eve Vault',
        event: 'change',
        payload: { chains: ['sui:mainnet'] },
      },
      window.location.origin,
    )
  })

  it('forwards sign_success messages to the page', () => {
    const postMessage = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined)

    content.forwardToPage({
      id: 'sign-id',
      type: 'sign_success',
      bytes: 'dGVzdA==',
      signature: 'c2ln',
    })

    expect(postMessage).toHaveBeenCalledWith(
      {
        __from: 'Eve Vault',
        id: 'sign-id',
        type: 'sign_success',
        bytes: 'dGVzdA==',
        signature: 'c2ln',
      },
      window.location.origin,
    )
  })

  it('forwards sign_success with digest and effects instead of bytes and signature', () => {
    const postMessage = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined)

    content.forwardToPage({
      id: 'sign-id',
      type: 'sign_success',
      digest: 'dGVzdA==',
      effects: 'ZWZm',
    })

    expect(postMessage).toHaveBeenCalledWith(
      {
        __from: 'Eve Vault',
        id: 'sign-id',
        type: 'sign_success',
        digest: 'dGVzdA==',
        effects: 'ZWZm',
      },
      window.location.origin,
    )
  })

  it('blocks sign_success missing both bytes and digest', () => {
    const postMessage = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined)

    content.forwardToPage({ id: 'sign-id', type: 'sign_success' })

    expect(postMessage).not.toHaveBeenCalled()
  })

  it('forwards sign_and_execute_transaction_success with a result object', () => {
    const postMessage = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined)

    content.forwardToPage({
      id: 'exec-id',
      type: 'sign_and_execute_transaction_success',
      result: { bytes: 'b', signature: 's', digest: 'd', effects: 'e' },
    })

    expect(postMessage).toHaveBeenCalledWith(
      {
        __from: 'Eve Vault',
        id: 'exec-id',
        type: 'sign_and_execute_transaction_success',
        result: { bytes: 'b', signature: 's', digest: 'd', effects: 'e' },
      },
      window.location.origin,
    )
  })

  it('blocks sign_and_execute_transaction_success when result is not an object', () => {
    const postMessage = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined)

    content.forwardToPage({
      id: 'exec-id',
      type: 'sign_and_execute_transaction_success',
      result: 'not-an-object',
    })

    expect(postMessage).not.toHaveBeenCalled()
  })

  it('forwards all public signing error types', () => {
    const errorTypes = [
      'sign_error',
      'sign_personal_message_error',
      'sign_transaction_error',
      'sign_and_execute_transaction_error',
      'sign_sponsored_transaction_error',
    ]

    for (const type of errorTypes) {
      const postMessage = vi
        .spyOn(window, 'postMessage')
        .mockImplementation(() => undefined)
      content.forwardToPage({ id: 'err-id', type, error: 'User rejected' })
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type,
          error: 'User rejected',
          __from: 'Eve Vault',
        }),
        window.location.origin,
      )
    }
  })

  it('blocks unknown signing error types', () => {
    const postMessage = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined)

    content.forwardToPage({
      id: 'err-id',
      type: 'sign_unknown_error',
      error: 'x',
    })

    expect(postMessage).not.toHaveBeenCalled()
  })

  it('forwards change events with a record payload', () => {
    const postMessage = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined)

    content.forwardToPage({
      __from: 'Eve Vault',
      event: 'change',
      payload: { chains: ['sui:testnet'] },
    })

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        __from: 'Eve Vault',
        event: 'change',
        payload: { chains: ['sui:testnet'] },
      }),
      window.location.origin,
    )
  })

  it('blocks change events with a non-record payload', () => {
    const postMessage = vi
      .spyOn(window, 'postMessage')
      .mockImplementation(() => undefined)

    content.forwardToPage({
      __from: 'Eve Vault',
      event: 'change',
      payload: 'not-an-object',
    })

    expect(postMessage).not.toHaveBeenCalled()
  })
})
