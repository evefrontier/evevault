import { VaultMessageTypes, WalletStandardMessageTypes } from '@evevault/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleMessage } from '@/lib/background/handlers/messageHandler'

const { mocks, logger } = vi.hoisted(() => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
  mocks: {
    handleDappLogin: vi.fn(),
    handleExtLogin: vi.fn(),
    handleWebUnlock: vi.fn(),
    handleApprovePopup: vi.fn(),
    handleSponsoredTransaction: vi.fn(),
    handleUnlockVault: vi.fn(),
    handleLock: vi.fn(),
  },
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
  _handleCreateKeypair: vi.fn(),
  _handleRotateKeypair: vi.fn(),
  _handleGetPublicKey: vi.fn(),
  _handleZkEphSignBytes: vi.fn(),
  _handleSetZkProof: vi.fn(),
  _handleGetZkProof: vi.fn(),
  _handleClearZkProof: vi.fn(),
  _handleLocalnetSetKeypair: vi.fn(),
  _handleLocalnetGetAddress: vi.fn(),
  _handleLocalnetSignBytes: vi.fn(),
}))

function installChromeMock() {
  vi.stubGlobal('chrome', {
    runtime: {
      id: 'extension-id',
    },
    tabs: {
      query: vi.fn((callback) => callback([{ id: 1 }, { id: 2 }])),
      sendMessage: vi.fn(),
    },
  } as unknown as typeof chrome)
}

function dappSender(): chrome.runtime.MessageSender {
  return {
    url: 'https://dapp.example/app',
    tab: {
      id: 42,
      url: 'https://dapp.example/app',
    } as chrome.tabs.Tab,
  }
}

function extensionSender(): chrome.runtime.MessageSender {
  return {
    url: 'chrome-extension://extension-id/popup.html',
  }
}

describe('handleMessage sender authorization', () => {
  beforeEach(() => {
    installChromeMock()
    vi.clearAllMocks()
  })

  it('allows public dApp connect messages from tab senders', () => {
    const sendResponse = vi.fn()

    const result = handleMessage(
      { type: 'connect', id: 'connect-id' },
      dappSender(),
      sendResponse,
    )

    expect(result).toBe(true)
    expect(mocks.handleDappLogin).toHaveBeenCalledWith(
      { type: 'connect', id: 'connect-id' },
      expect.objectContaining({ tab: expect.objectContaining({ id: 42 }) }),
      sendResponse,
      42,
    )
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

    const result = handleMessage(
      { type: VaultMessageTypes.LOCK },
      extensionSender(),
      sendResponse,
    )

    expect(result).toBe(true)
    expect(mocks.handleLock).toHaveBeenCalledWith(
      { type: VaultMessageTypes.LOCK },
      extensionSender(),
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
        { action: 'dapp_login', id: 'legacy-dapp-id' },
        dappSender(),
        sendResponse,
      ),
    ).toBe(false)
    expect(mocks.handleDappLogin).toHaveBeenCalledTimes(0)

    handleMessage(
      { event: 'change', payload: { accounts: [] } },
      dappSender(),
      sendResponse,
    )

    expect(chrome.tabs.query).not.toHaveBeenCalled()
  })

  it('allows wallet signing actions from tab senders only', () => {
    const sendResponse = vi.fn()
    mocks.handleApprovePopup.mockReturnValue(true)

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
})
