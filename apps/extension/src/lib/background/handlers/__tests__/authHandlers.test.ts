import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Browser } from 'wxt/browser'
import {
  clearPendingAuth,
  setPendingAuthAfterUnlock,
} from '../auth/pendingAuth'
import { checkPendingAuthAfterUnlock } from '../authHandlers'

const { mockHandleDappLogin } = vi.hoisted(() => ({
  mockHandleDappLogin: vi.fn(() => Promise.resolve()),
}))

vi.mock('../auth/dappLogin', () => ({ handleDappLogin: mockHandleDappLogin }))
vi.mock('../auth/extLogin', () => ({ handleExtLogin: vi.fn() }))
vi.mock('../auth/webUnlock', () => ({ handleWebUnlock: vi.fn() }))
vi.mock('@/lib/background/messaging/tabMessaging', () => ({
  sendToTab: vi.fn(),
}))

beforeEach(() => {
  clearPendingAuth()
  vi.clearAllMocks()
})

describe('checkPendingAuthAfterUnlock', () => {
  it('resumes a dApp connect with the page that asked, so its origin can be checked', () => {
    const sender = {
      origin: 'http://localhost:8092',
      url: 'http://localhost:8092/',
      tab: { id: 7, url: 'http://localhost:8092/' },
    } as Browser.runtime.MessageSender
    setPendingAuthAfterUnlock(
      'connect-1',
      'dapp',
      7,
      undefined,
      undefined,
      sender,
    )

    checkPendingAuthAfterUnlock()

    expect(mockHandleDappLogin).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'connect', id: 'connect-1' }),
      sender,
      expect.any(Function),
      7,
    )
  })

  it('falls back to the tab id when no sender was recorded', () => {
    setPendingAuthAfterUnlock('connect-2', 'dapp', 9)

    checkPendingAuthAfterUnlock()

    expect(mockHandleDappLogin).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'connect-2' }),
      { tab: { id: 9 } },
      expect.any(Function),
      9,
    )
  })
})
