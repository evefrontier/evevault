import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WebUnlockMessage } from '@/lib/background/types'
import { handleWebUnlock } from '../webUnlock'

const { mockStoreJwt, mockSendToTab, mockEnsureMessageId } = vi.hoisted(() => ({
  mockStoreJwt: vi.fn(),
  mockSendToTab: vi.fn(),
  mockEnsureMessageId: vi.fn((m: { id?: string }) => m.id ?? 'msg-id'),
}))

vi.mock('@evevault/shared', () => ({
  storeJwt: mockStoreJwt,
}))

vi.mock('@/lib/background/messaging/tabMessaging', () => ({
  sendToTab: mockSendToTab,
}))

vi.mock('../authHelpers', () => ({
  ensureMessageId: mockEnsureMessageId,
}))

vi.mock('@evevault/shared/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@evevault/shared/utils')>()
  return {
    ...actual,
    createLogger: () => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    }),
  }
})

const fakeJwt = {
  access_token: 'a',
  id_token: 'i',
  expires_in: 3600,
  scope: 'openid',
  token_type: 'Bearer',
}

function makeMessage(
  overrides: Partial<WebUnlockMessage> = {},
): WebUnlockMessage {
  return {
    id: 'msg-id',
    type: 'web_unlock',
    jwt: fakeJwt as never,
    tabId: 5,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockStoreJwt.mockResolvedValue(undefined)
})

describe('handleWebUnlock', () => {
  it('stores the JWT and sends auth_success to the tab', async () => {
    await handleWebUnlock(
      makeMessage(),
      {} as chrome.runtime.MessageSender,
      vi.fn(),
    )

    expect(mockStoreJwt).toHaveBeenCalledWith(fakeJwt)
    expect(mockSendToTab).toHaveBeenCalledWith(5, {
      id: 'msg-id',
      type: 'auth_success',
    })
  })

  it('stores the JWT without sending to tab when tabId is absent', async () => {
    await handleWebUnlock(
      makeMessage({ tabId: undefined }),
      {} as chrome.runtime.MessageSender,
      vi.fn(),
    )

    expect(mockStoreJwt).toHaveBeenCalledWith(fakeJwt)
    expect(mockSendToTab).not.toHaveBeenCalled()
  })

  it('sends auth_error to the tab when storeJwt throws', async () => {
    mockStoreJwt.mockRejectedValue(new Error('storage full'))

    await handleWebUnlock(
      makeMessage(),
      {} as chrome.runtime.MessageSender,
      vi.fn(),
    )

    expect(mockSendToTab).toHaveBeenCalledWith(5, {
      id: 'msg-id',
      type: 'auth_error',
      error: 'storage full',
    })
  })

  it('does not call sendToTab on error when tabId is absent', async () => {
    mockStoreJwt.mockRejectedValue(new Error('storage full'))

    await handleWebUnlock(
      makeMessage({ tabId: undefined }),
      {} as chrome.runtime.MessageSender,
      vi.fn(),
    )

    expect(mockSendToTab).not.toHaveBeenCalled()
  })

  it('uses a generic error message when the thrown value is not an Error', async () => {
    mockStoreJwt.mockRejectedValue('non-error string')

    await handleWebUnlock(
      makeMessage(),
      {} as chrome.runtime.MessageSender,
      vi.fn(),
    )

    expect(mockSendToTab).toHaveBeenCalledWith(5, {
      id: 'msg-id',
      type: 'auth_error',
      error: 'Failed to complete web unlock',
    })
  })
})
