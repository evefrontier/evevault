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
      { tab: { id: 42 } } as chrome.runtime.MessageSender,
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
})
