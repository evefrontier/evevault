import { storeJwt } from '@evevault/shared'
import { exchangeCodeForToken } from '@evevault/shared/auth'
import { useDeviceStore } from '@evevault/shared/stores'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAuthRequest } from '@/lib/background/services/oauthService'
import { openPopupWindow } from '@/lib/background/services/popupWindow'
import type { MessageWithId } from '@/lib/background/types'
import {
  getCurrentChainFromStorage,
  sendAuthError,
  sendExtensionAuthSuccess,
} from '../authHelpers'
import { handleExtLogin } from '../extLogin'
import { checkKeeperUnlocked } from '../keeperHelpers'
import { setPendingAuthAfterUnlock } from '../pendingAuth'

const { mocks, logger } = vi.hoisted(() => {
  const deviceState = {
    ephemeralKeyPairSecretKey: undefined as unknown,
    ephemeralPublicKey: undefined as unknown,
    networkData: {} as Record<string, { nonce?: string }>,
    initializeForChain: vi.fn(),
  }
  const useDeviceStoreMock = Object.assign(vi.fn(), {
    getState: vi.fn(() => deviceState),
    setState: vi.fn((partial: Record<string, unknown>) => {
      Object.assign(deviceState, partial)
    }),
  })

  return {
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
    mocks: {
      deviceState,
      useDeviceStoreMock,
      storeJwt: vi.fn(),
      exchangeCodeForToken: vi.fn(),
      getCurrentTenantId: vi.fn(),
      isAvailableTenantId: vi.fn(),
      createLogger: vi.fn(),
      getAuthRequest: vi.fn(),
      openPopupWindow: vi.fn(),
      ensureMessageId: vi.fn(),
      extractAuthCode: vi.fn(),
      getCurrentChain: vi.fn(),
      getCurrentChainFromStorage: vi.fn(),
      sendAuthError: vi.fn(),
      sendExtensionAuthSuccess: vi.fn(),
      checkKeeperUnlocked: vi.fn(),
      getEphemeralKeyPairSecretKeyFromStorage: vi.fn(),
      setPendingAuthAfterUnlock: vi.fn(),
    },
  }
})

vi.mock('@evevault/shared', () => ({
  storeJwt: mocks.storeJwt,
}))

vi.mock('@evevault/shared/auth', () => ({
  exchangeCodeForToken: mocks.exchangeCodeForToken,
}))

vi.mock('@evevault/shared/stores', () => ({
  getCurrentTenantId: mocks.getCurrentTenantId,
  isAvailableTenantId: mocks.isAvailableTenantId,
  useDeviceStore: mocks.useDeviceStoreMock,
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

vi.mock('../authHelpers', () => ({
  ensureMessageId: mocks.ensureMessageId,
  extractAuthCode: mocks.extractAuthCode,
  getCurrentChain: mocks.getCurrentChain,
  getCurrentChainFromStorage: mocks.getCurrentChainFromStorage,
  sendAuthError: mocks.sendAuthError,
  sendExtensionAuthSuccess: mocks.sendExtensionAuthSuccess,
}))

vi.mock('../keeperHelpers', () => ({
  checkKeeperUnlocked: mocks.checkKeeperUnlocked,
  getEphemeralKeyPairSecretKeyFromStorage:
    mocks.getEphemeralKeyPairSecretKeyFromStorage,
}))

vi.mock('../pendingAuth', () => ({
  KEEPER_RETRY_DELAY_MS: 1,
  setPendingAuthAfterUnlock: mocks.setPendingAuthAfterUnlock,
}))

const mockStoreJwt = vi.mocked(storeJwt)
const mockExchangeCodeForToken = vi.mocked(exchangeCodeForToken)
const mockUseDeviceStore = vi.mocked(useDeviceStore)
const mockGetAuthRequest = vi.mocked(getAuthRequest)
const mockOpenPopupWindow = vi.mocked(openPopupWindow)
const mockGetCurrentChainFromStorage = vi.mocked(getCurrentChainFromStorage)
const mockSendAuthError = vi.mocked(sendAuthError)
const mockSendExtensionAuthSuccess = vi.mocked(sendExtensionAuthSuccess)
const mockCheckKeeperUnlocked = vi.mocked(checkKeeperUnlocked)
const mockSetPendingAuthAfterUnlock = vi.mocked(setPendingAuthAfterUnlock)

function installChromeIdentityMock(responseUrl: string | undefined) {
  vi.stubGlobal('chrome', {
    runtime: {
      lastError: undefined,
    },
    identity: {
      getRedirectURL: vi.fn(() => 'https://extension.example/callback'),
      launchWebAuthFlow: vi.fn((_details, callback) => callback(responseUrl)),
    },
  } as unknown as typeof chrome)
}

function resetDeviceState() {
  mocks.deviceState.ephemeralKeyPairSecretKey = undefined
  mocks.deviceState.ephemeralPublicKey = undefined
  mocks.deviceState.networkData = {}
  mocks.deviceState.initializeForChain = vi.fn()
}

function makeMessage(overrides: Partial<MessageWithId> = {}): MessageWithId {
  return {
    id: 'message-id',
    ...overrides,
  }
}

describe('handleExtLogin', () => {
  beforeEach(() => {
    resetDeviceState()
    mocks.getCurrentTenantId.mockReturnValue('tenant-default')
    mocks.isAvailableTenantId.mockReturnValue(false)
    mocks.ensureMessageId.mockReturnValue('message-id')
    mocks.getCurrentChain.mockReturnValue('sui:testnet')
    mockGetCurrentChainFromStorage.mockResolvedValue('sui:testnet')
    mockOpenPopupWindow.mockResolvedValue(77)
    mockGetAuthRequest.mockResolvedValue({
      authUrl: new URL('https://auth.example/login'),
      codeVerifier: 'verifier',
    })
    mocks.extractAuthCode.mockReturnValue('auth-code')
    mockExchangeCodeForToken.mockResolvedValue({ id_token: 'id-token' })
    mockStoreJwt.mockResolvedValue(undefined)
    installChromeIdentityMock(
      'https://extension.example/callback?code=auth-code',
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('opens the vault and sends an auth error when there is no stored device data', async () => {
    mockCheckKeeperUnlocked.mockResolvedValue({ unlocked: false })
    mockOpenPopupWindow.mockResolvedValue(undefined)

    await handleExtLogin(
      makeMessage(),
      {} as chrome.runtime.MessageSender,
      vi.fn(),
    )

    expect(mockUseDeviceStore.setState).toHaveBeenCalledWith({
      isLocked: true,
    })
    expect(mockOpenPopupWindow).toHaveBeenCalledWith('popup')
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to open vault popup window',
    )
    expect(mockSendAuthError).toHaveBeenCalledWith('message-id', {
      message:
        'Please set up or unlock the vault in the window we opened, then try again.',
      vaultOpened: true,
    })
    expect(mockSetPendingAuthAfterUnlock).not.toHaveBeenCalled()
  })

  it('stores pending auth after retrying a locked vault with stored device data', async () => {
    vi.useFakeTimers()
    mocks.deviceState.ephemeralKeyPairSecretKey = { iv: 'iv', data: 'data' }
    mockCheckKeeperUnlocked.mockResolvedValue({ unlocked: false })

    const promise = handleExtLogin(
      makeMessage(),
      {} as chrome.runtime.MessageSender,
      vi.fn(),
    )
    await vi.advanceTimersByTimeAsync(301)
    await promise

    expect(mockCheckKeeperUnlocked).toHaveBeenCalledTimes(3)
    expect(mockSetPendingAuthAfterUnlock).toHaveBeenCalledWith(
      'message-id',
      'ext',
      undefined,
      77,
      'tenant-default',
    )
    expect(mockSendAuthError).not.toHaveBeenCalled()
  })

  it('sends an auth error when keeper is unlocked but no public key exists', async () => {
    mockCheckKeeperUnlocked.mockResolvedValue({ unlocked: true })

    await handleExtLogin(
      makeMessage(),
      {} as chrome.runtime.MessageSender,
      vi.fn(),
    )

    expect(mockSendAuthError).toHaveBeenCalledWith('message-id', {
      message: 'Vault state is inconsistent. Please unlock the vault again.',
    })
    expect(mockGetAuthRequest).not.toHaveBeenCalled()
  })

  it('syncs public key bytes from keeper before starting OAuth', async () => {
    const publicKeyBytes = Array.from({ length: 32 }, (_, index) => index + 1)
    const storedSecretKey = { iv: 'iv', data: 'data' }
    mockCheckKeeperUnlocked.mockResolvedValue({
      unlocked: true,
      publicKeyBytes,
    })
    mocks.getEphemeralKeyPairSecretKeyFromStorage.mockResolvedValue(
      storedSecretKey,
    )
    mocks.deviceState.networkData = {
      'sui:testnet': { nonce: 'nonce-value' },
    }

    await handleExtLogin(
      makeMessage(),
      {} as chrome.runtime.MessageSender,
      vi.fn(),
    )

    await vi.waitFor(() => {
      expect(mockSendExtensionAuthSuccess).toHaveBeenCalledWith('message-id', {
        id_token: 'id-token',
      })
    })
    expect(mockUseDeviceStore.setState).toHaveBeenCalledWith(
      expect.objectContaining({
        ephemeralPublicKeyBytes: publicKeyBytes,
        ephemeralKeyPairSecretKey: storedSecretKey,
        isLocked: false,
      }),
    )
    expect(mockGetAuthRequest).toHaveBeenCalledWith({
      tenantId: 'tenant-default',
      nonce: 'nonce-value',
    })
  })

  it('sends an auth error when keeper public key bytes cannot be synced', async () => {
    mockCheckKeeperUnlocked.mockResolvedValue({
      unlocked: true,
      publicKeyBytes: [1, 2, 3],
    })
    mocks.deviceState.networkData = {
      'sui:testnet': { nonce: 'nonce-value' },
    }

    await handleExtLogin(
      makeMessage(),
      {} as chrome.runtime.MessageSender,
      vi.fn(),
    )

    expect(mockSendAuthError).toHaveBeenCalledWith('message-id', {
      message: 'Failed to sync vault state. Please try unlocking again.',
    })
    expect(mockGetAuthRequest).not.toHaveBeenCalled()
  })

  it('uses an explicitly available tenant and completes OAuth successfully', async () => {
    mocks.isAvailableTenantId.mockReturnValue(true)
    mocks.deviceState.ephemeralPublicKey = { existing: true }
    mocks.deviceState.networkData = {
      'sui:testnet': { nonce: 'nonce-value' },
    }

    await handleExtLogin(
      makeMessage({ tenantId: 'tenant-explicit' }),
      {} as chrome.runtime.MessageSender,
      vi.fn(),
    )

    await vi.waitFor(() => {
      expect(mockSendExtensionAuthSuccess).toHaveBeenCalledWith('message-id', {
        id_token: 'id-token',
      })
    })
    expect(mockGetAuthRequest).toHaveBeenCalledWith({
      tenantId: 'tenant-explicit',
      nonce: 'nonce-value',
    })
    expect(mockExchangeCodeForToken).toHaveBeenCalledWith(
      'auth-code',
      'https://extension.example/callback',
      'tenant-explicit',
      { codeVerifier: 'verifier' },
    )
    expect(mockStoreJwt).toHaveBeenCalledWith(
      { id_token: 'id-token' },
      'sui:testnet',
    )
  })

  it('initializes device data when the current chain has no nonce yet', async () => {
    mocks.deviceState.ephemeralPublicKey = { existing: true }
    mocks.deviceState.networkData = { 'sui:testnet': {} }
    mocks.deviceState.initializeForChain = vi.fn(async (chain: string) => {
      mocks.deviceState.networkData[chain] = { nonce: 'initialized-nonce' }
    })

    await handleExtLogin(
      makeMessage(),
      {} as chrome.runtime.MessageSender,
      vi.fn(),
    )

    await vi.waitFor(() => {
      expect(mockGetAuthRequest).toHaveBeenCalledWith({
        tenantId: 'tenant-default',
        nonce: 'initialized-nonce',
      })
    })
  })

  it('aborts OAuth when the network changes before token storage', async () => {
    mocks.deviceState.ephemeralPublicKey = { existing: true }
    mocks.deviceState.networkData = {
      'sui:testnet': { nonce: 'nonce-value' },
    }
    mockGetCurrentChainFromStorage
      .mockResolvedValueOnce('sui:testnet')
      .mockResolvedValueOnce('sui:devnet')

    await handleExtLogin(
      makeMessage(),
      {} as chrome.runtime.MessageSender,
      vi.fn(),
    )

    await vi.waitFor(() => {
      expect(mockSendAuthError).toHaveBeenCalledWith('message-id', {
        message:
          'Network was switched during login. Please try logging in again.',
      })
    })
    expect(mockStoreJwt).not.toHaveBeenCalled()
    expect(mockSendExtensionAuthSuccess).not.toHaveBeenCalled()
  })
})
