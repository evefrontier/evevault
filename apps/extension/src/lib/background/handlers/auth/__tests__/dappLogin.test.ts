import { getJwt, getZkLoginAddress } from '@evevault/shared/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleDappLogin } from '../dappLogin'
import { checkKeeperUnlocked } from '../keeperHelpers'

const { mocks, logger } = vi.hoisted(() => {
  const deviceState = {
    ephemeralKeyPairSecretKey: { iv: 'iv', data: 'data' },
    ephemeralPublicKey: { flag: vi.fn() },
    networkData: {},
    initializeForChain: vi.fn(),
  }

  return {
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
    mocks: {
      deviceState,
      useContextStore: {
        getState: vi.fn(() => ({
          chain: 'sui:testnet',
          tenantId: 'tenant-id',
        })),
      },
      useDeviceStore: Object.assign(vi.fn(), {
        getState: vi.fn(() => deviceState),
        setState: vi.fn((partial: Record<string, unknown>) => {
          Object.assign(deviceState, partial)
        }),
      }),
      getJwt: vi.fn(),
      getZkLoginAddress: vi.fn(),
      exchangeCodeForToken: vi.fn(),
      storeJwt: vi.fn(),
      getAuthRequest: vi.fn(),
      openPopupWindow: vi.fn(),
      sendToKeeper: vi.fn(),
      checkKeeperUnlocked: vi.fn(),
      getEphemeralKeyPairSecretKeyFromStorage: vi.fn(),
      addPendingDappId: vi.fn(),
      clearPendingAuth: vi.fn(),
      getPending: vi.fn(),
      setPendingAuthAfterUnlock: vi.fn(),
      setPendingAuthWindowId: vi.fn(),
    },
  }
})

vi.mock('@evevault/shared', () => ({
  storeJwt: mocks.storeJwt,
}))

vi.mock('@evevault/shared/auth', () => ({
  exchangeCodeForToken: mocks.exchangeCodeForToken,
  getJwt: mocks.getJwt,
  getZkLoginAddress: mocks.getZkLoginAddress,
}))

vi.mock('@evevault/shared/stores', () => ({
  useContextStore: mocks.useContextStore,
  useDeviceStore: mocks.useDeviceStore,
}))

vi.mock('@evevault/shared/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@evevault/shared/utils')>()
  return {
    ...actual,
    createLogger: () => logger,
  }
})

vi.mock('@/lib/background/services/oauthService', () => ({
  getAuthRequest: mocks.getAuthRequest,
}))

vi.mock('@/lib/background/services/popupWindow', () => ({
  openPopupWindow: mocks.openPopupWindow,
}))

vi.mock('../keeperHelpers', () => ({
  checkKeeperUnlocked: mocks.checkKeeperUnlocked,
  getEphemeralKeyPairSecretKeyFromStorage:
    mocks.getEphemeralKeyPairSecretKeyFromStorage,
}))

vi.mock('../pendingAuth', () => ({
  addPendingDappId: mocks.addPendingDappId,
  clearPendingAuth: mocks.clearPendingAuth,
  getPending: mocks.getPending,
  KEEPER_RETRY_DELAY_MS: 1,
  setPendingAuthAfterUnlock: mocks.setPendingAuthAfterUnlock,
  setPendingAuthWindowId: mocks.setPendingAuthWindowId,
}))

vi.mock('../../vaultHandlers', () => ({
  sendToKeeper: mocks.sendToKeeper,
}))

const mockGetJwt = vi.mocked(getJwt)
const mockGetZkLoginAddress = vi.mocked(getZkLoginAddress)
const mockCheckKeeperUnlocked = vi.mocked(checkKeeperUnlocked)

function installChromeMock() {
  vi.stubGlobal('chrome', {
    tabs: {
      sendMessage: vi.fn(() => Promise.resolve()),
    },
    identity: {
      getRedirectURL: vi.fn(() => 'chrome-extension://extension-id/callback'),
      launchWebAuthFlow: vi.fn(),
    },
    runtime: {
      lastError: undefined,
    },
    storage: {
      local: {
        get: vi.fn(async () => ({})),
        set: vi.fn(async () => undefined),
      },
    },
  } as unknown as typeof chrome)
}

describe('handleDappLogin', () => {
  beforeEach(() => {
    installChromeMock()
    vi.clearAllMocks()
    mocks.deviceState.ephemeralKeyPairSecretKey = { iv: 'iv', data: 'data' }
    mocks.deviceState.ephemeralPublicKey = { flag: vi.fn() }
    mocks.deviceState.networkData = {}
    mocks.useContextStore.getState.mockReturnValue({
      chain: 'sui:testnet',
      tenantId: 'tenant-id',
    })
    mocks.useDeviceStore.getState.mockReturnValue(mocks.deviceState)
    mockCheckKeeperUnlocked.mockResolvedValue({ unlocked: true })
    mockGetJwt.mockResolvedValue({
      access_token: 'access-token',
      id_token: 'id-token',
      expires_in: 3600,
      scope: 'openid',
      token_type: 'Bearer',
    })
    mockGetZkLoginAddress.mockResolvedValue({
      data: {
        address: '0xzk',
        publicKey: 'AQID',
      },
      error: undefined,
    })
  })

  it('sends dApps account metadata without OAuth token material', async () => {
    await handleDappLogin(
      { id: 'connect-id' },
      {
        origin: 'https://dapp.example',
        url: 'https://dapp.example/connect',
        tab: {
          id: 42,
          url: 'https://dapp.example/connect',
          title: 'Example dApp',
        },
      } as chrome.runtime.MessageSender,
      vi.fn(),
      42,
    )

    expect(mockGetZkLoginAddress).toHaveBeenCalledWith({
      jwt: 'access-token',
      enokiApiKey: '',
    })
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(42, {
      id: 'connect-id',
      type: 'auth_success',
      chain: 'sui:testnet',
      address: '0xzk',
      publicKey: 'AQID',
    })
    expect(chrome.tabs.sendMessage).not.toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        token: expect.anything(),
      }),
    )
  })

  it('silently returns without sending to tab when sender has no tab id', async () => {
    await handleDappLogin(
      { id: 'ext-req' },
      {
        origin: 'chrome-extension://extension-id',
      } as chrome.runtime.MessageSender,
      vi.fn(),
      undefined,
    )

    expect(chrome.tabs.sendMessage).not.toHaveBeenCalled()
  })

  it('sends auth_error to the tab when the keeper is locked and there is no device data', async () => {
    mocks.deviceState.ephemeralKeyPairSecretKey = null
    mockCheckKeeperUnlocked.mockResolvedValue({ unlocked: false })
    mocks.openPopupWindow.mockResolvedValue(55)

    await handleDappLogin(
      { id: 'locked-req' },
      {
        origin: 'https://dapp.example',
        tab: { id: 10, url: 'https://dapp.example/' },
      } as chrome.runtime.MessageSender,
      vi.fn(),
      10,
    )

    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        id: 'locked-req',
        type: 'auth_error',
        error: expect.objectContaining({
          vaultOpened: true,
          message: expect.stringContaining('set up or unlock'),
        }),
      }),
    )
  })

  it('deduplicates a second connect from the same tab when one is already pending', async () => {
    mockCheckKeeperUnlocked.mockResolvedValue({ unlocked: false })
    mocks.deviceState.ephemeralKeyPairSecretKey = { iv: 'iv', data: 'data' }
    mocks.getPending.mockReturnValue({ type: 'dapp', tabId: 20 })
    mocks.addPendingDappId.mockReturnValue(true)

    await handleDappLogin(
      { id: 'dup-req' },
      {
        origin: 'https://dapp.example',
        tab: { id: 20, url: 'https://dapp.example/' },
      } as chrome.runtime.MessageSender,
      vi.fn(),
      20,
    )

    expect(mocks.addPendingDappId).toHaveBeenCalledWith(20, 'dup-req')
    expect(mocks.openPopupWindow).not.toHaveBeenCalled()
    expect(chrome.tabs.sendMessage).not.toHaveBeenCalled()
  })

  it('sends auth_error when the popup window fails to open (no device data)', async () => {
    mocks.deviceState.ephemeralKeyPairSecretKey = null
    mockCheckKeeperUnlocked.mockResolvedValue({ unlocked: false })
    mocks.openPopupWindow.mockResolvedValue(undefined)

    await handleDappLogin(
      { id: 'popup-fail' },
      {
        origin: 'https://dapp.example',
        tab: { id: 7, url: 'https://dapp.example/' },
      } as chrome.runtime.MessageSender,
      vi.fn(),
      7,
    )

    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        type: 'auth_error',
        error: expect.objectContaining({
          message: expect.stringContaining('Failed to open vault window'),
        }),
      }),
    )
  })

  it('retries keeper check and succeeds when unlocked on retry', async () => {
    mocks.deviceState.ephemeralKeyPairSecretKey = { iv: 'iv', data: 'data' }
    mockCheckKeeperUnlocked
      .mockResolvedValueOnce({ unlocked: false })
      .mockResolvedValueOnce({ unlocked: true, publicKeyBytes: undefined })
    mocks.deviceState.ephemeralPublicKey = { flag: vi.fn() }

    await handleDappLogin(
      { id: 'retry-req' },
      {
        origin: 'https://dapp.example',
        tab: { id: 42, url: 'https://dapp.example/' },
      } as chrome.runtime.MessageSender,
      vi.fn(),
      42,
    )

    expect(mockCheckKeeperUnlocked).toHaveBeenCalledTimes(2)
    expect(mocks.openPopupWindow).not.toHaveBeenCalled()
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ type: 'auth_success' }),
    )
  })

  it('sends auth_error when zkLogin address lookup fails', async () => {
    mockGetZkLoginAddress.mockResolvedValue({
      data: undefined,
      error: { message: 'Enoki lookup failed' },
    })

    await handleDappLogin(
      { id: 'zk-fail' },
      {
        origin: 'https://dapp.example',
        tab: { id: 42, url: 'https://dapp.example/' },
      } as chrome.runtime.MessageSender,
      vi.fn(),
      42,
    )

    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(42, {
      id: 'zk-fail',
      type: 'auth_error',
      error: expect.objectContaining({ message: 'Enoki lookup failed' }),
    })
  })

  it('sends auth_error when zkLogin address is missing from the response', async () => {
    mockGetZkLoginAddress.mockResolvedValue({
      data: { address: undefined, publicKey: undefined },
      error: undefined,
    })

    await handleDappLogin(
      { id: 'zk-no-addr' },
      {
        origin: 'https://dapp.example',
        tab: { id: 42, url: 'https://dapp.example/' },
      } as chrome.runtime.MessageSender,
      vi.fn(),
      42,
    )

    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        type: 'auth_error',
        error: expect.objectContaining({
          message: expect.stringContaining('account metadata'),
        }),
      }),
    )
  })
})
