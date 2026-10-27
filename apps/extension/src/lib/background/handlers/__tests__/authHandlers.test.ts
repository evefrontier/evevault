import { beforeEach, describe, expect, it, vi } from 'vitest'
import { connectDapp } from '../auth/dappLogin'
import { getPendingAndClear, takePendingDapp } from '../auth/pendingAuth'
import { checkPendingAuthAfterUnlock } from '../authHandlers'

const { logger, listeners, tabsGet } = vi.hoisted(() => {
  const listeners: { tabRemoved?: (tabId: number) => void } = {}
  const tabsGet = vi.fn()
  // authHandlers registers its tab listener at import time.
  ;(globalThis as { browser?: unknown }).browser = {
    tabs: {
      get: tabsGet,
      onRemoved: {
        addListener: (listener: (tabId: number) => void) => {
          listeners.tabRemoved = listener
        },
      },
    },
  }

  return {
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
    listeners,
    tabsGet,
  }
})

vi.mock('@evevault/shared/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@evevault/shared/utils')>()
  return {
    ...actual,
    createLogger: () => logger,
  }
})

vi.mock('../auth/dappLogin', () => ({
  connectDapp: vi.fn(async () => undefined),
  handleDappLogin: vi.fn(async () => undefined),
}))

vi.mock('../auth/extLogin', () => ({
  handleExtLogin: vi.fn(async () => undefined),
}))

vi.mock('../auth/webUnlock', () => ({
  handleWebUnlock: vi.fn(),
}))

vi.mock('../auth/pendingAuth', () => ({
  clearPendingAuth: vi.fn(),
  getPending: vi.fn(),
  getPendingAndClear: vi.fn(),
  sendPendingAuthError: vi.fn(),
  takePendingDapp: vi.fn(),
}))

const mockConnectDapp = vi.mocked(connectDapp)
const mockGetPendingAndClear = vi.mocked(getPendingAndClear)
const mockTakePendingDapp = vi.mocked(takePendingDapp)

const dappContext = {
  origin: 'https://dapp.example',
  url: 'https://dapp.example/connect',
  title: 'Example dApp',
}

describe('checkPendingAuthAfterUnlock (dapp)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetPendingAndClear.mockReturnValue({
      id: 'connect-id',
      type: 'dapp',
      target: { tabId: 42, documentId: 'doc-1' },
      dappContext,
      additionalIds: ['connect-id-2'],
    })
  })

  it('resumes the connect with the document and context captured at request time', async () => {
    checkPendingAuthAfterUnlock()

    await vi.waitFor(() => expect(mockConnectDapp).toHaveBeenCalledTimes(1))
    expect(mockConnectDapp).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'connect-id',
        additionalIds: ['connect-id-2'],
        target: { tabId: 42, documentId: 'doc-1' },
        dappContext,
      }),
    )
    expect(tabsGet).not.toHaveBeenCalled()
  })

  it('logs when the resumed connect fails', async () => {
    mockConnectDapp.mockRejectedValueOnce(new Error('boom'))

    checkPendingAuthAfterUnlock()

    await vi.waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to resume dapp login after unlock',
        expect.any(Error),
      ),
    )
  })
})

describe('tabs.onRemoved listener', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('drops the pending dapp login for the closed tab', () => {
    mockTakePendingDapp.mockReturnValue({
      id: 'connect-id',
      type: 'dapp',
      target: { tabId: 42, documentId: 'doc-1' },
      dappContext,
      additionalIds: [],
    })

    listeners.tabRemoved?.(42)

    expect(mockTakePendingDapp).toHaveBeenCalledWith(42)
    expect(logger.debug).toHaveBeenCalledWith(
      'Dropped pending dapp login for closed tab',
      { tabId: 42 },
    )
  })

  it('does nothing when no pending belongs to the closed tab', () => {
    mockTakePendingDapp.mockReturnValue(null)

    listeners.tabRemoved?.(7)

    expect(mockTakePendingDapp).toHaveBeenCalledWith(7)
    expect(logger.debug).not.toHaveBeenCalled()
  })
})
