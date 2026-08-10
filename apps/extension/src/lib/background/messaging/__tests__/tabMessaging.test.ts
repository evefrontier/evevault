import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { logger } = vi.hoisted(() => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

vi.mock('@evevault/shared/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@evevault/shared/utils')>()
  return {
    ...actual,
    createLogger: () => logger,
    // Keep hasNoTokenMaterial real so the token-material guard is exercised.
  }
})

function installBrowserMock(rejectSend = false) {
  vi.stubGlobal('browser', {
    tabs: {
      sendMessage: rejectSend
        ? vi.fn(() => Promise.reject(new Error('Tab closed')))
        : vi.fn(() => Promise.resolve()),
    },
  } as unknown as typeof browser)
}

import { sendToTab } from '../tabMessaging'

beforeEach(() => {
  installBrowserMock()
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('sendToTab', () => {
  it('delivers a safe message to the target tab', () => {
    sendToTab(42, { type: 'auth_error', id: 'msg-1' })

    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(42, {
      type: 'auth_error',
      id: 'msg-1',
    })
  })

  it('forwards the exact message object to the target tab id', () => {
    const msg = {
      type: 'auth_success' as const,
      id: 'fwd-1',
      chain: 'sui:testnet' as const,
      address: '0xabc',
    }
    sendToTab(99, msg)
    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(99, msg)
  })

  it('logs an error when browser.tabs.sendMessage rejects', async () => {
    installBrowserMock(true)

    sendToTab(7, { type: 'auth_error', id: 'err-msg' })

    // The rejection is caught internally; wait for the microtask queue.
    await Promise.resolve()

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to send message to tab',
      expect.objectContaining({ tabId: 7, err: expect.any(Error) }),
    )
  })

  it('blocks and logs messages that contain token material without sending to the tab', () => {
    // The TypeScript type forbids token fields at compile time; bypass with unknown cast
    // to exercise the runtime hasNoTokenMaterial guard and the inDevBuild() code path.
    const msgWithToken = {
      type: 'auth_error',
      id: 'tok-test',
      id_token: 'secret-token',
    } as unknown as Parameters<typeof sendToTab>[1]

    // In vitest, import.meta.env.DEV is true, so sendToTab throws to make the
    // violation hard to miss during development. In production it logs and returns.
    expect(() => sendToTab(5, msgWithToken)).toThrow(
      'sendToTab: token material must never be sent to a tab',
    )
    expect(logger.error).toHaveBeenCalledWith(
      'Blocked tab-bound message containing token material',
      { type: 'auth_error' },
    )
    expect(browser.tabs.sendMessage).not.toHaveBeenCalled()
  })
})
