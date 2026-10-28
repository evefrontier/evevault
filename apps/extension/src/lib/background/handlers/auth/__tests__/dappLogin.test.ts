import { getJwt, getZkLoginAddress } from '@evevault/shared/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Browser } from 'wxt/browser'
import { connectDapp, handleDappLogin } from '../dappLogin'
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
      setPendingAuthAfterUnlock: vi.fn(),
      setPendingAuthWindowId: vi.fn(),
      takePendingAttempt: vi.fn(),
      sendPendingAuthError: vi.fn(),
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
  KEEPER_RETRY_DELAY_MS: 1,
  setPendingAuthAfterUnlock: mocks.setPendingAuthAfterUnlock,
  setPendingAuthWindowId: mocks.setPendingAuthWindowId,
  takePendingAttempt: mocks.takePendingAttempt,
  sendPendingAuthError: mocks.sendPendingAuthError,
}))

vi.mock('../../vaultHandlers', () => ({
  sendToKeeper: mocks.sendToKeeper,
}))

const mockGetJwt = vi.mocked(getJwt)
const mockGetZkLoginAddress = vi.mocked(getZkLoginAddress)
const mockCheckKeeperUnlocked = vi.mocked(checkKeeperUnlocked)

function installBrowserMock() {
  vi.stubGlobal('browser', {
    tabs: {
      sendMessage: vi.fn(async () => undefined),
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
  } as unknown as typeof browser)
}

describe('handleDappLogin', () => {
  beforeEach(() => {
    installBrowserMock()
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
    mocks.addPendingDappId.mockReturnValue(false)
    mocks.setPendingAuthAfterUnlock.mockReturnValue(1)
    mocks.takePendingAttempt.mockReturnValue(null)
    mockGetJwt.mockResolvedValue({
      access_token: 'access-token',
      id_token: 'id-token',
      expires_in: 3600,
      scope: 'openid',
      token_type: 'Bearer',
    })
    mockGetZkLoginAddress.mockResolvedValue({
      address: '0xzk',
      publicKey: 'AQID',
      salt: '99',
    })
  })

  it('sends dApps account metadata without OAuth token material', async () => {
    await handleDappLogin(
      { id: 'connect-id' },
      {
        origin: 'https://dapp.example',
        documentId: 'doc-1',
        url: 'https://dapp.example/connect',
        tab: {
          id: 42,
          url: 'https://dapp.example/connect',
          title: 'Example dApp',
        },
      } as Browser.runtime.MessageSender,
      vi.fn(),
      42,
    )

    expect(mockGetZkLoginAddress).toHaveBeenCalledWith({
      jwt: 'access-token',
    })
    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(
      42,
      {
        id: 'connect-id',
        type: 'auth_success',
        chain: 'sui:testnet',
        address: '0xzk',
        publicKey: 'AQID',
      },
      { documentId: 'doc-1' },
    )
    expect(browser.tabs.sendMessage).not.toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        token: expect.anything(),
      }),
      { documentId: 'doc-1' },
    )
  })

  it('delivers a resumed connect only to the stored document', async () => {
    await connectDapp({
      id: 'resumed-id',
      additionalIds: ['extra-id'],
      target: { tabId: 42, documentId: 'doc-9' },
      dappContext: { origin: 'https://dapp.example' },
    })

    const calls = vi.mocked(browser.tabs.sendMessage).mock.calls
    expect(
      calls.map(([tabId, message, options]) => [
        tabId,
        (message as { id: string }).id,
        options,
      ]),
    ).toEqual([
      [42, 'resumed-id', { documentId: 'doc-9' }],
      [42, 'extra-id', { documentId: 'doc-9' }],
    ])
  })

  it('drops a connect whose sender has no documentId without replying', async () => {
    await handleDappLogin(
      { id: 'no-doc' },
      {
        origin: 'https://dapp.example',
        tab: { id: 42, url: 'https://dapp.example/connect' },
      } as Browser.runtime.MessageSender,
      vi.fn(),
      42,
    )

    expect(browser.tabs.sendMessage).not.toHaveBeenCalled()
    expect(mockCheckKeeperUnlocked).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(
      'Dropping connect without a sender documentId',
      { tabId: 42 },
    )
  })

  it('rejects an invalid page origin with an error to the sender document only', async () => {
    await handleDappLogin(
      { id: 'bad-origin' },
      {
        origin: 'chrome-extension://other-extension',
        documentId: 'doc-1',
        tab: { id: 42 },
      } as Browser.runtime.MessageSender,
      vi.fn(),
      42,
    )

    expect(browser.tabs.sendMessage).toHaveBeenCalledTimes(1)
    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        id: 'bad-origin',
        type: 'auth_error',
        error: expect.objectContaining({
          message: 'Connect requests must come from a valid web page origin.',
        }),
      }),
      { documentId: 'doc-1' },
    )
    expect(mockCheckKeeperUnlocked).not.toHaveBeenCalled()
  })

  it('ignores additionalIds supplied by the page', async () => {
    await handleDappLogin(
      { id: 'connect-id', additionalIds: ['injected-id'] } as never,
      {
        origin: 'https://dapp.example',
        documentId: 'doc-1',
        tab: { id: 42, url: 'https://dapp.example/connect' },
      } as Browser.runtime.MessageSender,
      vi.fn(),
      42,
    )

    const sentIds = vi
      .mocked(browser.tabs.sendMessage)
      .mock.calls.map(([, message]) => (message as { id: string }).id)
    expect(sentIds).toEqual(['connect-id'])
  })

  it('silently returns without sending to tab when sender has no tab id', async () => {
    await handleDappLogin(
      { id: 'no-tab' },
      {
        origin: 'https://dapp.example',
        documentId: 'doc-1',
      } as Browser.runtime.MessageSender,
      vi.fn(),
      undefined,
    )

    expect(browser.tabs.sendMessage).not.toHaveBeenCalled()
    expect(mockCheckKeeperUnlocked).not.toHaveBeenCalled()
    expect(mocks.openPopupWindow).not.toHaveBeenCalled()
  })

  it('sends auth_error to the tab when the keeper is locked and there is no device data', async () => {
    mocks.deviceState.ephemeralKeyPairSecretKey = null
    mockCheckKeeperUnlocked.mockResolvedValue({ unlocked: false })
    mocks.openPopupWindow.mockResolvedValue(55)

    await handleDappLogin(
      { id: 'locked-req' },
      {
        origin: 'https://dapp.example',
        documentId: 'doc-1',
        tab: { id: 10, url: 'https://dapp.example/' },
      } as Browser.runtime.MessageSender,
      vi.fn(),
      10,
    )

    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        id: 'locked-req',
        type: 'auth_error',
        error: expect.objectContaining({
          vaultOpened: true,
          message: expect.stringContaining('set up or unlock'),
        }),
      }),
      { documentId: 'doc-1' },
    )
  })

  it('deduplicates a second connect from the same tab when one is already pending', async () => {
    mockCheckKeeperUnlocked.mockResolvedValue({ unlocked: false })
    mocks.deviceState.ephemeralKeyPairSecretKey = { iv: 'iv', data: 'data' }
    mocks.addPendingDappId.mockReturnValue(true)

    await handleDappLogin(
      { id: 'dup-req' },
      {
        origin: 'https://dapp.example',
        documentId: 'doc-1',
        tab: { id: 20, url: 'https://dapp.example/' },
      } as Browser.runtime.MessageSender,
      vi.fn(),
      20,
    )

    expect(mocks.addPendingDappId).toHaveBeenCalledWith(
      { tabId: 20, documentId: 'doc-1' },
      'dup-req',
      expect.objectContaining({ origin: 'https://dapp.example' }),
    )
    expect(mocks.openPopupWindow).not.toHaveBeenCalled()
    expect(browser.tabs.sendMessage).not.toHaveBeenCalled()
  })

  it('records the sender document and context when parking a connect for vault unlock', async () => {
    mockCheckKeeperUnlocked.mockResolvedValue({ unlocked: false })
    mocks.openPopupWindow.mockResolvedValue(77)

    await handleDappLogin(
      { id: 'locked-with-device' },
      {
        origin: 'https://dapp.example',
        documentId: 'doc-1',
        tab: { id: 30, url: 'https://dapp.example/app' },
      } as Browser.runtime.MessageSender,
      vi.fn(),
      30,
    )

    expect(mocks.setPendingAuthAfterUnlock).toHaveBeenCalledWith({
      id: 'locked-with-device',
      type: 'dapp',
      target: { tabId: 30, documentId: 'doc-1' },
      dappContext: expect.objectContaining({
        origin: 'https://dapp.example',
        url: 'https://dapp.example/app',
      }),
    })
    expect(mocks.setPendingAuthWindowId).toHaveBeenCalledWith(1, 77)
    expect(browser.tabs.sendMessage).not.toHaveBeenCalled()
  })

  it('sends auth_error to every pending id when the popup fails to open', async () => {
    mockCheckKeeperUnlocked.mockResolvedValue({ unlocked: false })
    mocks.openPopupWindow.mockResolvedValue(undefined)
    const pending = {
      id: 'retargeted-id',
      type: 'dapp' as const,
      target: { tabId: 7, documentId: 'doc-2' },
      dappContext: { origin: 'https://other.example' },
      additionalIds: ['extra-id'],
    }
    mocks.takePendingAttempt.mockReturnValue(pending)

    await handleDappLogin(
      { id: 'popup-fail' },
      {
        origin: 'https://dapp.example',
        documentId: 'doc-1',
        tab: { id: 7, url: 'https://dapp.example/' },
      } as Browser.runtime.MessageSender,
      vi.fn(),
      7,
    )

    expect(mocks.takePendingAttempt).toHaveBeenCalledWith(1)
    // Errors go to every id at the document the pending now belongs to.
    expect(mocks.sendPendingAuthError).toHaveBeenCalledWith(
      pending,
      'Failed to open vault window. Please try again.',
    )
    expect(browser.tabs.sendMessage).not.toHaveBeenCalled()
  })

  it('sends nothing when a late popup failure belongs to a replaced attempt', async () => {
    mockCheckKeeperUnlocked.mockResolvedValue({ unlocked: false })
    mocks.openPopupWindow.mockResolvedValue(undefined)
    mocks.takePendingAttempt.mockReturnValue(null)

    await handleDappLogin(
      { id: 'stale' },
      {
        origin: 'https://dapp.example',
        documentId: 'doc-1',
        tab: { id: 7, url: 'https://dapp.example/' },
      } as Browser.runtime.MessageSender,
      vi.fn(),
      7,
    )

    expect(mocks.takePendingAttempt).toHaveBeenCalledWith(1)
    expect(mocks.sendPendingAuthError).not.toHaveBeenCalled()
    expect(browser.tabs.sendMessage).not.toHaveBeenCalled()
  })

  it('resumes a parked connect after unlock and replies to its document', async () => {
    mockCheckKeeperUnlocked.mockResolvedValue({ unlocked: false })
    mocks.openPopupWindow.mockResolvedValue(77)

    await handleDappLogin(
      { id: 'parked-id' },
      {
        origin: 'https://dapp.example',
        documentId: 'doc-1',
        tab: { id: 30, url: 'https://dapp.example/app' },
      } as Browser.runtime.MessageSender,
      vi.fn(),
      30,
    )
    expect(browser.tabs.sendMessage).not.toHaveBeenCalled()

    // Resume as checkPendingAuthAfterUnlock does, from the stored entry.
    const [parked] = mocks.setPendingAuthAfterUnlock.mock.calls[0]
    mockCheckKeeperUnlocked.mockResolvedValue({ unlocked: true })
    await connectDapp({ ...parked, additionalIds: [] })

    expect(browser.tabs.sendMessage).toHaveBeenCalledTimes(1)
    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(
      30,
      {
        id: 'parked-id',
        type: 'auth_success',
        chain: 'sui:testnet',
        address: '0xzk',
        publicKey: 'AQID',
      },
      { documentId: 'doc-1' },
    )
  })

  it('sends auth_error when the popup window fails to open (no device data)', async () => {
    mocks.deviceState.ephemeralKeyPairSecretKey = null
    mockCheckKeeperUnlocked.mockResolvedValue({ unlocked: false })
    mocks.openPopupWindow.mockResolvedValue(undefined)

    await handleDappLogin(
      { id: 'popup-fail' },
      {
        origin: 'https://dapp.example',
        documentId: 'doc-1',
        tab: { id: 7, url: 'https://dapp.example/' },
      } as Browser.runtime.MessageSender,
      vi.fn(),
      7,
    )

    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        type: 'auth_error',
        error: expect.objectContaining({
          message: expect.stringContaining('Failed to open vault window'),
        }),
      }),
      { documentId: 'doc-1' },
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
        documentId: 'doc-1',
        tab: { id: 42, url: 'https://dapp.example/' },
      } as Browser.runtime.MessageSender,
      vi.fn(),
      42,
    )

    expect(mockCheckKeeperUnlocked).toHaveBeenCalledTimes(2)
    expect(mocks.openPopupWindow).not.toHaveBeenCalled()
    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ type: 'auth_success' }),
      { documentId: 'doc-1' },
    )
  })

  it('sends auth_error when the zkLogin address lookup throws', async () => {
    mockGetZkLoginAddress.mockRejectedValue(
      new Error('zkLogin address request failed (401): unauthorized'),
    )

    await handleDappLogin(
      { id: 'zk-fail' },
      {
        origin: 'https://dapp.example',
        documentId: 'doc-1',
        tab: { id: 42, url: 'https://dapp.example/' },
      } as Browser.runtime.MessageSender,
      vi.fn(),
      42,
    )

    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        id: 'zk-fail',
        type: 'auth_error',
        error: expect.objectContaining({
          message: expect.stringContaining('account metadata'),
        }),
      }),
      { documentId: 'doc-1' },
    )
  })

  it('sends auth_error when zkLogin address is missing from the response', async () => {
    mockGetZkLoginAddress.mockResolvedValue({
      address: undefined,
      publicKey: undefined,
      salt: undefined,
    } as unknown as Awaited<ReturnType<typeof getZkLoginAddress>>)

    await handleDappLogin(
      { id: 'zk-no-addr' },
      {
        origin: 'https://dapp.example',
        documentId: 'doc-1',
        tab: { id: 42, url: 'https://dapp.example/' },
      } as Browser.runtime.MessageSender,
      vi.fn(),
      42,
    )

    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        type: 'auth_error',
        error: expect.objectContaining({
          message: expect.stringContaining('account metadata'),
        }),
      }),
      { documentId: 'doc-1' },
    )
  })

  describe('silent connect', () => {
    const sender = {
      origin: 'https://dapp.example',
      documentId: 'doc-1',
      tab: { id: 42, url: 'https://dapp.example/' },
    } as Browser.runtime.MessageSender

    function seedPermission(chains: string[]) {
      vi.mocked(browser.storage.local.get).mockResolvedValue({
        dappPermissions: {
          'https://dapp.example': {
            origin: 'https://dapp.example',
            chains,
            connectedAt: 1,
            updatedAt: 1,
          },
        },
      })
    }

    function connectSilently() {
      return handleDappLogin(
        { id: 'silent-id', silent: true },
        sender,
        vi.fn(),
        42,
      )
    }

    function expectDeclined(reason: string) {
      expect(browser.tabs.sendMessage).toHaveBeenCalledTimes(1)
      expect(browser.tabs.sendMessage).toHaveBeenCalledWith(
        42,
        {
          id: 'silent-id',
          type: 'auth_error',
          error: { message: `Silent connect declined: ${reason}.` },
        },
        { documentId: 'doc-1' },
      )
      expect(mocks.openPopupWindow).not.toHaveBeenCalled()
      expect(mocks.addPendingDappId).not.toHaveBeenCalled()
      expect(mocks.setPendingAuthAfterUnlock).not.toHaveBeenCalled()
      expect(browser.identity.launchWebAuthFlow).not.toHaveBeenCalled()
    }

    it('declines an origin with no stored permission before checking the vault', async () => {
      await connectSilently()

      expectDeclined('site not connected')
      expect(mockCheckKeeperUnlocked).not.toHaveBeenCalled()
    })

    it('declines an origin permitted only on another chain', async () => {
      seedPermission(['sui:devnet'])

      await connectSilently()

      expectDeclined('site not connected')
    })

    it('declines a permitted origin while the vault is locked without parking it', async () => {
      seedPermission(['sui:testnet'])
      mockCheckKeeperUnlocked.mockResolvedValue({ unlocked: false })

      await connectSilently()

      expectDeclined('vault is locked')
      expect(mocks.useDeviceStore.setState).not.toHaveBeenCalledWith({
        isLocked: true,
      })
    })

    it('declines a permitted origin when the vault is not set up', async () => {
      seedPermission(['sui:testnet'])
      mocks.deviceState.ephemeralKeyPairSecretKey = null
      mockCheckKeeperUnlocked.mockResolvedValue({ unlocked: false })

      await connectSilently()

      expectDeclined('vault is not set up')
    })

    it('declines a permitted origin when there is no session instead of starting OAuth', async () => {
      seedPermission(['sui:testnet'])
      mockGetJwt.mockResolvedValue(null)

      await connectSilently()

      expectDeclined('not signed in')
      expect(mocks.getAuthRequest).not.toHaveBeenCalled()
    })

    it('connects a permitted origin from the existing session without UI', async () => {
      seedPermission(['sui:testnet'])

      await connectSilently()

      expect(browser.tabs.sendMessage).toHaveBeenCalledWith(
        42,
        {
          id: 'silent-id',
          type: 'auth_success',
          chain: 'sui:testnet',
          address: '0xzk',
          publicKey: 'AQID',
        },
        { documentId: 'doc-1' },
      )
      expect(mocks.openPopupWindow).not.toHaveBeenCalled()
      expect(browser.identity.launchWebAuthFlow).not.toHaveBeenCalled()
    })

    it('treats a non-boolean silent flag as an interactive connect', async () => {
      mockCheckKeeperUnlocked.mockResolvedValue({ unlocked: false })
      mocks.openPopupWindow.mockResolvedValue(77)

      await handleDappLogin(
        { id: 'silent-id', silent: 'true' },
        sender,
        vi.fn(),
        42,
      )

      expect(mocks.setPendingAuthAfterUnlock).toHaveBeenCalled()
      expect(mocks.openPopupWindow).toHaveBeenCalledWith('popup')
    })
  })
})
