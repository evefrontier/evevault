import { CONTEXT_STORAGE_KEY } from '@evevault/shared/utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildExtensionAuthSuccessToken,
  ensureMessageId,
  extractAuthCode,
  getCurrentChainFromStorage,
  sendAuthError,
  sendDappConnectSuccessToTab,
  sendExtensionAuthSuccess,
} from '../authHelpers'

const { mockSendToTab, mockGetChain, mockDecodeJwt } = vi.hoisted(() => ({
  mockSendToTab: vi.fn(),
  mockGetChain: vi.fn(() => 'sui:testnet' as const),
  mockDecodeJwt: vi.fn(),
}))

vi.mock('@/lib/background/messaging/tabMessaging', () => ({
  sendToTab: mockSendToTab,
}))

vi.mock('@evevault/shared/stores', () => ({
  useContextStore: {
    getState: () => ({ chain: mockGetChain() }),
  },
}))

vi.mock('jose', () => ({
  decodeJwt: mockDecodeJwt,
}))

function installChromeMock() {
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: vi.fn(),
    },
    storage: {
      local: {
        get: vi.fn(),
      },
    },
    tabs: {
      sendMessage: vi.fn(),
    },
  } as unknown as typeof chrome)
}

beforeEach(() => {
  installChromeMock()
  vi.clearAllMocks()
  mockDecodeJwt.mockReturnValue({
    email: 'user@example.com',
    sub: 'user-sub-123',
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('extractAuthCode', () => {
  it('returns the code query parameter from the URL', () => {
    expect(
      extractAuthCode('https://example.com/callback?code=abc123&state=xyz'),
    ).toBe('abc123')
  })

  it('returns null when no code parameter is present', () => {
    expect(extractAuthCode('https://example.com/callback?state=xyz')).toBeNull()
  })
})

describe('ensureMessageId', () => {
  it('returns the id when present', () => {
    expect(ensureMessageId({ id: 'msg-id-1' })).toBe('msg-id-1')
  })

  it('throws when id is missing', () => {
    expect(() => ensureMessageId({})).toThrow('Message id is required')
  })

  it('throws when id is empty string', () => {
    expect(() => ensureMessageId({ id: '' })).toThrow('Message id is required')
  })
})

describe('buildExtensionAuthSuccessToken', () => {
  const baseJwt = {
    access_token: 'access-tok',
    id_token: 'header.eyJlbWFpbCI6InVAZS5jb20iLCJzdWIiOiJzdWItMTIzIn0.sig',
    expires_in: 3600,
    scope: 'openid',
    token_type: 'Bearer',
    refresh_token: 'refresh-tok',
    refresh_token_id: 'rid-1',
    expires_at: 9999999,
  }

  it('maps JWT fields onto the token shape', () => {
    mockDecodeJwt.mockReturnValue({
      email: 'mapped@example.com',
      sub: 'mapped-sub',
    })
    const token = buildExtensionAuthSuccessToken({
      ...baseJwt,
      userId: 'explicit-user-id',
    })
    expect(token).toMatchObject({
      access_token: 'access-tok',
      id_token: baseJwt.id_token,
      expires_in: 3600,
      scope: 'openid',
      token_type: 'Bearer',
      refresh_token: 'refresh-tok',
      refresh_token_id: 'rid-1',
      expires_at: 9999999,
      email: 'mapped@example.com',
      userId: 'explicit-user-id',
    })
  })

  it('falls back to decodeJwt sub when userId is absent from JWT', () => {
    mockDecodeJwt.mockReturnValue({
      email: 'other@example.com',
      sub: 'sub-from-jwt',
    })
    const token = buildExtensionAuthSuccessToken({
      ...baseJwt,
      userId: undefined,
    })
    expect(token.userId).toBe('sub-from-jwt')
    expect(token.userId).not.toBe('other@example.com')
    expect(mockDecodeJwt).toHaveBeenCalled()
  })

  it('uses the explicit userId without calling sub extraction when present', () => {
    mockDecodeJwt.mockReturnValue({
      email: 'other@example.com',
      sub: 'sub-from-jwt',
    })
    const token = buildExtensionAuthSuccessToken({
      ...baseJwt,
      userId: 'explicit-user-id',
    })
    expect(token.userId).toBe('explicit-user-id')
    expect(token.userId).not.toBe('sub-from-jwt')
  })
})

describe('getCurrentChainFromStorage', () => {
  it('resolves chain from stored JSON string', async () => {
    const stored = JSON.stringify({ state: { chain: 'sui:mainnet' } })
    ;(chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(
      (_keys: unknown, callback: (result: Record<string, unknown>) => void) => {
        callback({ [CONTEXT_STORAGE_KEY]: stored })
      },
    )

    const chain = await getCurrentChainFromStorage()
    expect(chain).toBe('sui:mainnet')
  })

  it('resolves chain from stored object (already parsed)', async () => {
    const stored = { state: { chain: 'sui:devnet' } }
    ;(chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(
      (_keys: unknown, callback: (result: Record<string, unknown>) => void) => {
        callback({ [CONTEXT_STORAGE_KEY]: stored })
      },
    )

    const chain = await getCurrentChainFromStorage()
    expect(chain).toBe('sui:devnet')
  })

  it('falls back to Zustand when storage returns nothing', async () => {
    mockGetChain.mockReturnValue('sui:mainnet')
    ;(chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(
      (_keys: unknown, callback: (result: Record<string, unknown>) => void) => {
        callback({})
      },
    )

    const chain = await getCurrentChainFromStorage()
    expect(chain).toBe('sui:mainnet')
  })

  it('falls back to Zustand when stored value has no chain field', async () => {
    mockGetChain.mockReturnValue('sui:devnet')
    ;(chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(
      (_keys: unknown, callback: (result: Record<string, unknown>) => void) => {
        callback({ [CONTEXT_STORAGE_KEY]: { state: {} } })
      },
    )

    const chain = await getCurrentChainFromStorage()
    expect(chain).toBe('sui:devnet')
  })

  it('falls back to Zustand when JSON.parse throws', async () => {
    mockGetChain.mockReturnValue('sui:localnet')
    ;(chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(
      (_keys: unknown, callback: (result: Record<string, unknown>) => void) => {
        callback({ [CONTEXT_STORAGE_KEY]: 'not-valid-json{{{' })
      },
    )

    const chain = await getCurrentChainFromStorage()
    expect(chain).toBe('sui:localnet')
  })
})

describe('sendExtensionAuthSuccess', () => {
  it('sends an AUTH_SUCCESS message via chrome.runtime.sendMessage', () => {
    const jwt = {
      access_token: 'a',
      id_token: 'i',
      expires_in: 3600,
      scope: 'openid',
      token_type: 'Bearer',
      refresh_token: 'r',
      refresh_token_id: 'rid',
      expires_at: 0,
      userId: 'u-1',
    }

    sendExtensionAuthSuccess('msg-id', jwt)

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'msg-id',
        type: 'auth_success',
        token: expect.objectContaining({
          access_token: 'a',
          id_token: 'i',
          expires_in: 3600,
          scope: 'openid',
          token_type: 'Bearer',
          refresh_token: 'r',
          refresh_token_id: 'rid',
          expires_at: 0,
          userId: 'u-1',
        }),
      }),
    )
  })
})

describe('sendAuthError', () => {
  it('sends an auth_error message via chrome.runtime.sendMessage', () => {
    sendAuthError('err-id', { message: 'something went wrong' })
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      id: 'err-id',
      type: 'auth_error',
      error: { message: 'something went wrong' },
    })
  })
})

describe('sendDappConnectSuccessToTab', () => {
  it('sends one auth_success per id', () => {
    sendDappConnectSuccessToTab(5, ['id-a', 'id-b'], {
      chain: 'sui:testnet',
      address: '0xabc',
      publicKey: 'AQID',
    })

    expect(mockSendToTab).toHaveBeenCalledTimes(2)
    expect(mockSendToTab).toHaveBeenCalledWith(
      5,
      expect.objectContaining({
        id: 'id-a',
        type: 'auth_success',
        chain: 'sui:testnet',
        address: '0xabc',
        publicKey: 'AQID',
      }),
    )
    expect(mockSendToTab).toHaveBeenCalledWith(
      5,
      expect.objectContaining({
        id: 'id-b',
        type: 'auth_success',
        chain: 'sui:testnet',
        address: '0xabc',
        publicKey: 'AQID',
      }),
    )
  })

  it('omits publicKey when not provided', () => {
    sendDappConnectSuccessToTab(3, ['id-x'], {
      chain: 'sui:testnet',
      address: '0xdef',
    })

    expect(mockSendToTab).toHaveBeenCalledWith(
      3,
      expect.not.objectContaining({ publicKey: expect.anything() }),
    )
  })
})
