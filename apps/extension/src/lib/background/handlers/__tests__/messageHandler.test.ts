import { VaultMessageTypes, WalletStandardMessageTypes } from '@evevault/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Browser } from 'wxt/browser'
import { handleMessage } from '@/lib/background/handlers/messageHandler'

const { logger, mocks } = vi.hoisted(() => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
  mocks: {
    getDappRequestContext: vi.fn(),
    revokeDappPermission: vi.fn(),
    handleDappLogin: vi.fn(),
    handleExtLogin: vi.fn(),
    handleWebUnlock: vi.fn(),
    handleApprovePopup: vi.fn(),
    handleSponsoredTransaction: vi.fn(),
    handleUnlockVault: vi.fn(),
    handleLock: vi.fn(),
    handleCreateKeypair: vi.fn(),
    handleRotateKeypair: vi.fn(),
    handleGetPublicKey: vi.fn(),
    handleGetUnlockRemaining: vi.fn(),
    handleZkEphSignBytes: vi.fn(),
    handleSetZkProof: vi.fn(),
    handleGetZkProof: vi.fn(),
    handleClearZkProof: vi.fn(),
    handleLocalnetSetKeypair: vi.fn(),
    handleLocalnetGetAddress: vi.fn(),
    handleLocalnetSignBytes: vi.fn(),
  },
}))

vi.mock('@/lib/background/services/dappPermissions', () => ({
  getDappRequestContext: mocks.getDappRequestContext,
  revokeDappPermission: mocks.revokeDappPermission,
}))

vi.mock('@evevault/shared/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@evevault/shared/utils')>()
  return {
    ...actual,
    createLogger: () => logger,
  }
})

vi.mock('@/lib/background/handlers/authHandlers', () => ({
  handleDappLogin: mocks.handleDappLogin,
  handleExtLogin: mocks.handleExtLogin,
  handleWebUnlock: mocks.handleWebUnlock,
}))

vi.mock('@/lib/background/handlers/walletHandlers', () => ({
  handleApprovePopup: mocks.handleApprovePopup,
}))

vi.mock('@/lib/background/handlers/sponsoredTransactionHandler', () => ({
  handleSponsoredTransaction: mocks.handleSponsoredTransaction,
}))

vi.mock('@/lib/background/handlers/vaultHandlers', () => ({
  handleUnlockVault: mocks.handleUnlockVault,
  handleLock: mocks.handleLock,
  _handleCreateKeypair: mocks.handleCreateKeypair,
  _handleRotateKeypair: mocks.handleRotateKeypair,
  _handleGetPublicKey: mocks.handleGetPublicKey,
  _handleGetUnlockRemaining: mocks.handleGetUnlockRemaining,
  _handleZkEphSignBytes: mocks.handleZkEphSignBytes,
  _handleSetZkProof: mocks.handleSetZkProof,
  _handleGetZkProof: mocks.handleGetZkProof,
  _handleClearZkProof: mocks.handleClearZkProof,
  _handleLocalnetSetKeypair: mocks.handleLocalnetSetKeypair,
  _handleLocalnetGetAddress: mocks.handleLocalnetGetAddress,
  _handleLocalnetSignBytes: mocks.handleLocalnetSignBytes,
}))

function installBrowserMock() {
  vi.stubGlobal('browser', {
    runtime: {
      id: 'extension-id',
      getURL: (path: string) => `chrome-extension://extension-id${path}`,
    },
    tabs: {
      query: vi.fn(async () => [{ id: 1 }, { id: 2 }]),
      sendMessage: vi.fn(async () => undefined),
    },
  } as unknown as typeof browser)
}

function dappSender(): Browser.runtime.MessageSender {
  return {
    origin: 'https://dapp.example',
    url: 'https://dapp.example/app',
    tab: {
      id: 42,
      url: 'https://dapp.example/app',
    } as Browser.tabs.Tab,
  }
}

function extensionSender(): Browser.runtime.MessageSender {
  return {
    url: 'chrome-extension://extension-id/popup.html',
  }
}

function extensionTabSender(): Browser.runtime.MessageSender {
  return {
    origin: 'chrome-extension://extension-id',
    url: 'chrome-extension://extension-id/sign_transaction.html',
    tab: {
      id: 77,
      url: 'chrome-extension://extension-id/sign_transaction.html',
    } as Browser.tabs.Tab,
  }
}

describe('handleMessage route policy', () => {
  beforeEach(() => {
    installBrowserMock()
    vi.clearAllMocks()
    mocks.getDappRequestContext.mockImplementation(
      (sender: Browser.runtime.MessageSender) =>
        sender.tab
          ? {
              origin: 'https://dapp.example',
              url: 'https://dapp.example/app',
            }
          : null,
    )
    mocks.handleDappLogin.mockResolvedValue(undefined)
    mocks.handleExtLogin.mockResolvedValue(undefined)
    mocks.handleWebUnlock.mockResolvedValue(undefined)
    mocks.handleApprovePopup.mockReturnValue(true)
    mocks.handleSponsoredTransaction.mockResolvedValue(true)
    mocks.handleGetPublicKey.mockResolvedValue(true)
    mocks.revokeDappPermission.mockResolvedValue({
      ok: true,
      context: { origin: 'https://dapp.example' },
      hadPermission: true,
    })
  })

  it('allows public dApp connect messages from tab senders', () => {
    const sendResponse = vi.fn()
    const sender = dappSender()
    const result = handleMessage(
      { type: 'connect', id: 'connect-id' },
      sender,
      sendResponse,
    )
    expect(result).toBe(true)
    expect(mocks.handleDappLogin).toHaveBeenCalledWith(
      { type: 'connect', id: 'connect-id' },
      sender,
      sendResponse,
      42,
    )
  })

  it('rejects public dApp connect messages from extension senders', () => {
    const sendResponse = vi.fn()

    expect(
      handleMessage(
        { type: 'connect', id: 'connect-id' },
        extensionSender(),
        sendResponse,
      ),
    ).toBe(false)
    expect(mocks.handleDappLogin).not.toHaveBeenCalled()
    expect(sendResponse).toHaveBeenCalledWith({
      type: 'auth_error',
      error: { message: 'Unauthorized message sender' },
    })
  })

  it('rejects public dApp connect messages from extension tab senders', () => {
    const sendResponse = vi.fn()

    expect(
      handleMessage(
        { type: 'connect', id: 'connect-id' },
        extensionTabSender(),
        sendResponse,
      ),
    ).toBe(false)
    expect(mocks.handleDappLogin).not.toHaveBeenCalled()
    expect(sendResponse).toHaveBeenCalledWith({
      type: 'auth_error',
      error: { message: 'Unauthorized message sender' },
    })
  })

  it('rejects vault messages from tab senders', () => {
    const sendResponse = vi.fn()

    const result = handleMessage(
      { type: VaultMessageTypes.UNLOCK_VAULT, pin: '123456' },
      dappSender(),
      sendResponse,
    )

    expect(result).toBe(false)
    expect(mocks.handleUnlockVault).not.toHaveBeenCalled()
    expect(sendResponse).toHaveBeenCalledWith({
      type: 'auth_error',
      error: { message: 'Unauthorized message sender' },
    })
  })

  it('allows vault messages from extension senders', () => {
    const sendResponse = vi.fn()
    const sender = extensionSender()

    const result = handleMessage(
      { type: VaultMessageTypes.LOCK },
      sender,
      sendResponse,
    )

    expect(result).toBe(true)
    expect(mocks.handleLock).toHaveBeenCalledWith(
      { type: VaultMessageTypes.LOCK },
      sender,
      sendResponse,
    )
  })

  it('allows vault messages from extension tab senders', () => {
    const sendResponse = vi.fn()
    const sender = extensionTabSender()

    const result = handleMessage(
      { type: VaultMessageTypes.ZK_EPH_SIGN_BYTES },
      sender,
      sendResponse,
    )

    expect(result).toBe(true)
    expect(mocks.handleZkEphSignBytes).toHaveBeenCalledWith(
      { type: VaultMessageTypes.ZK_EPH_SIGN_BYTES },
      sender,
      sendResponse,
    )
  })

  it('rejects internal auth and spoofed change messages from tab senders', () => {
    const sendResponse = vi.fn()

    expect(
      handleMessage(
        { action: 'ext_login', id: 'auth-id' },
        dappSender(),
        sendResponse,
      ),
    ).toBe(false)
    expect(mocks.handleExtLogin).not.toHaveBeenCalled()

    expect(
      handleMessage(
        { event: 'change', payload: { accounts: [] } },
        dappSender(),
        sendResponse,
      ),
    ).toBe(false)
    expect(browser.tabs.query).not.toHaveBeenCalled()
  })

  it('allows wallet signing actions from tab senders only', () => {
    const sendResponse = vi.fn()

    expect(
      handleMessage(
        { action: WalletStandardMessageTypes.SIGN_TRANSACTION, id: 'sign-id' },
        dappSender(),
        sendResponse,
      ),
    ).toBe(true)
    expect(mocks.handleApprovePopup).toHaveBeenCalled()

    mocks.handleApprovePopup.mockClear()

    expect(
      handleMessage(
        { action: WalletStandardMessageTypes.SIGN_TRANSACTION, id: 'sign-id' },
        extensionSender(),
        sendResponse,
      ),
    ).toBe(false)
    expect(mocks.handleApprovePopup).not.toHaveBeenCalled()
  })

  it('routes wallet signing actions from tab senders without resolving dApp context', () => {
    const sendResponse = vi.fn()
    const sender = { tab: { id: 42 } } as Browser.runtime.MessageSender
    expect(
      handleMessage(
        { action: WalletStandardMessageTypes.SIGN_TRANSACTION, id: 'sign-id' },
        sender,
        sendResponse,
      ),
    ).toBe(true)
    expect(mocks.handleApprovePopup).toHaveBeenCalledWith(
      { action: WalletStandardMessageTypes.SIGN_TRANSACTION, id: 'sign-id' },
      sender,
      sendResponse,
    )
    expect(mocks.getDappRequestContext).not.toHaveBeenCalled()
    expect(sendResponse).not.toHaveBeenCalled()
  })

  it('routes sponsored signing actions through the async route wrapper', () => {
    const sendResponse = vi.fn()
    const sender = dappSender()
    const message = {
      action: WalletStandardMessageTypes.EVEFRONTIER_SIGN_SPONSORED_TRANSACTION,
      id: 'sponsored-id',
      message: { action: 'mine', assembly: '1', assemblyType: 'type' },
    }
    expect(handleMessage(message, sender, sendResponse)).toBe(true)
    expect(mocks.handleSponsoredTransaction).toHaveBeenCalledWith(
      message,
      sender,
      sendResponse,
    )
  })

  it('revokes dApp permission and sends disconnect success to the page', async () => {
    const sendResponse = vi.fn()
    const sender = dappSender()
    expect(
      handleMessage(
        { type: WalletStandardMessageTypes.DISCONNECT, id: 'disconnect-id' },
        sender,
        sendResponse,
      ),
    ).toBe(true)
    await vi.waitFor(() => {
      expect(mocks.revokeDappPermission).toHaveBeenCalledWith(sender)
    })
    expect(sendResponse).toHaveBeenCalledWith({
      id: 'disconnect-id',
      type: 'disconnect_success',
    })
    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(42, {
      id: 'disconnect-id',
      type: 'disconnect_success',
    })
  })

  it('sends disconnect error when revocation fails', async () => {
    mocks.revokeDappPermission.mockResolvedValueOnce({
      ok: false,
      error: 'revocation failed',
    })
    const sendResponse = vi.fn()

    expect(
      handleMessage(
        { type: WalletStandardMessageTypes.DISCONNECT, id: 'disconnect-id' },
        dappSender(),
        sendResponse,
      ),
    ).toBe(true)

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        id: 'disconnect-id',
        type: 'disconnect_error',
        error: { message: 'revocation failed' },
      })
    })
    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(42, {
      id: 'disconnect-id',
      type: 'disconnect_error',
      error: { message: 'revocation failed' },
    })
  })

  it('sends disconnect_error when handleDappDisconnect throws unexpectedly', async () => {
    mocks.revokeDappPermission.mockRejectedValueOnce(new Error('DB exploded'))
    const sendResponse = vi.fn()

    handleMessage(
      { type: WalletStandardMessageTypes.DISCONNECT, id: 'disc-err' },
      dappSender(),
      sendResponse,
    )

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        id: 'disc-err',
        type: 'disconnect_error',
        error: { message: 'DB exploded' },
      })
    })
  })

  it('sends disconnect_error with Unknown error occurred for non-Error throws', async () => {
    mocks.revokeDappPermission.mockRejectedValueOnce('plain string')
    const sendResponse = vi.fn()

    handleMessage(
      { type: WalletStandardMessageTypes.DISCONNECT, id: 'disc-str' },
      dappSender(),
      sendResponse,
    )

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        id: 'disc-str',
        type: 'disconnect_error',
        error: { message: 'Unknown error occurred' },
      })
    })
  })

  it('broadcasts change events to all tabs when sent by extension', async () => {
    const sendResponse = vi.fn()
    const result = handleMessage(
      { event: 'change', payload: { accounts: ['0xabc'] } },
      extensionSender(),
      sendResponse,
    )

    expect(result).toBe(true)
    expect(browser.tabs.query).toHaveBeenCalled()
    // browser.tabs.query resolves as a promise, so sendMessage fires on a microtask.
    await vi.waitFor(() => {
      expect(browser.tabs.sendMessage).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          event: 'change',
          payload: { accounts: ['0xabc'] },
        }),
      )
    })
    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ event: 'change' }),
    )
  })

  it('returns undefined for messages with no matching route and no change event', () => {
    const sendResponse = vi.fn()
    const result = handleMessage(
      { type: 'totally_unknown' } as Parameters<typeof handleMessage>[0],
      extensionSender(),
      sendResponse,
    )

    expect(result).toBeUndefined()
    expect(sendResponse).not.toHaveBeenCalled()
  })
})
