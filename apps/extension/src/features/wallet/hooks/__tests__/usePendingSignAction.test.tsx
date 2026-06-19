import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePendingSignAction } from '../usePendingSignAction'

const { mockUseSignPopupAuth } = vi.hoisted(() => ({
  mockUseSignPopupAuth: vi.fn(),
}))

vi.mock('../useSignPopupAuth', () => ({
  useSignPopupAuth: mockUseSignPopupAuth,
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

const AUTH_STUB = {
  isLocked: false,
  isPinSet: true,
  unlock: vi.fn(),
  user: { id_token: 'tok' },
  loading: false,
  login: vi.fn(),
  ephemeralPublicKey: {},
  maxEpoch: 100,
}

function makeOptions(parsePending = vi.fn(async (a: unknown) => a)) {
  return {
    parsePending,
    missingError: 'No pending action',
    rejectError: 'User rejected',
    rejectFailureError: 'Reject failed',
    rejectLogMessage: 'handleReject error',
    getWindowId: (p: { windowId: number }) => p.windowId,
  }
}

function stubStorage(pendingAction: unknown) {
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: vi.fn(() => Promise.resolve({ pendingAction })),
        set: vi.fn(() => Promise.resolve()),
      },
    },
  } as unknown as typeof chrome)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseSignPopupAuth.mockReturnValue(AUTH_STUB)
})

describe('usePendingSignAction', () => {
  describe('initial load', () => {
    it('sets error to missingError when pendingAction is absent', async () => {
      stubStorage(undefined)
      const { result } = renderHook(() => usePendingSignAction(makeOptions()))

      await waitFor(() =>
        expect(result.current.error).toBe('No pending action'),
      )
      expect(result.current.pending).toBeNull()
    })

    it('sets pending after parsePending resolves', async () => {
      const action = { windowId: 1, requestId: 'req-1' }
      stubStorage(action)
      const { result } = renderHook(() => usePendingSignAction(makeOptions()))

      await waitFor(() => expect(result.current.pending).toEqual(action))
      expect(result.current.error).toBeNull()
    })

    it('sets error when parsePending throws', async () => {
      stubStorage({ windowId: 1 })
      const parse = vi.fn().mockRejectedValue(new Error('bad payload'))
      const { result } = renderHook(() =>
        usePendingSignAction(makeOptions(parse)),
      )

      await waitFor(() => expect(result.current.error).toBe('bad payload'))
      expect(result.current.pending).toBeNull()
    })

    it('sets error when chrome.storage.local.get rejects', async () => {
      vi.stubGlobal('chrome', {
        storage: {
          local: {
            get: vi.fn(() => Promise.reject(new Error('idb crash'))),
          },
        },
      } as unknown as typeof chrome)

      const { result } = renderHook(() => usePendingSignAction(makeOptions()))

      await waitFor(() => expect(result.current.error).toBe('idb crash'))
    })
  })

  describe('storeResult', () => {
    it('returns false and does not write when pending is null', async () => {
      stubStorage(undefined)
      const { result } = renderHook(() => usePendingSignAction(makeOptions()))
      await waitFor(() =>
        expect(result.current.error).toBe('No pending action'),
      )

      const stored = await result.current.storeResult({
        status: 'error',
        error: 'x',
      })
      expect(stored).toBe(false)
      expect(chrome.storage.local.set).not.toHaveBeenCalled()
    })

    it('returns false and does not write when requestId is missing', async () => {
      const action = { windowId: 1 } // no requestId
      stubStorage(action)
      const { result } = renderHook(() => usePendingSignAction(makeOptions()))
      await waitFor(() => expect(result.current.pending).toEqual(action))

      const stored = await result.current.storeResult({
        status: 'error',
        error: 'x',
      })
      expect(stored).toBe(false)
      expect(chrome.storage.local.set).not.toHaveBeenCalled()
    })

    it('writes transactionResult and returns true when pending has requestId', async () => {
      const action = { windowId: 7, requestId: 'req-abc' }
      stubStorage(action)
      const { result } = renderHook(() => usePendingSignAction(makeOptions()))
      await waitFor(() => expect(result.current.pending).toEqual(action))

      const stored = await result.current.storeResult({
        status: 'error',
        error: 'rejected',
      })
      expect(stored).toBe(true)
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        transactionResult: {
          status: 'error',
          error: 'rejected',
          windowId: 7,
          requestId: 'req-abc',
        },
      })
    })
  })

  describe('storeErrorResult', () => {
    it('writes an error-status result', async () => {
      const action = { windowId: 3, requestId: 'req-err' }
      stubStorage(action)
      const { result } = renderHook(() => usePendingSignAction(makeOptions()))
      await waitFor(() => expect(result.current.pending).toEqual(action))

      await result.current.storeErrorResult('something went wrong')
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        transactionResult: {
          status: 'error',
          error: 'something went wrong',
          windowId: 3,
          requestId: 'req-err',
        },
      })
    })
  })

  describe('handleReject', () => {
    it('is a no-op when there is no pending action', async () => {
      stubStorage(undefined)
      const closeSpy = vi
        .spyOn(window, 'close')
        .mockImplementation(() => undefined)
      const { result } = renderHook(() => usePendingSignAction(makeOptions()))
      await waitFor(() =>
        expect(result.current.error).toBe('No pending action'),
      )

      await act(() => result.current.handleReject())

      expect(chrome.storage.local.set).not.toHaveBeenCalled()
      expect(closeSpy).not.toHaveBeenCalled()
    })

    it('stores the reject error and closes the window on success', async () => {
      const action = { windowId: 2, requestId: 'req-close' }
      stubStorage(action)
      const closeSpy = vi
        .spyOn(window, 'close')
        .mockImplementation(() => undefined)
      const { result } = renderHook(() => usePendingSignAction(makeOptions()))
      await waitFor(() => expect(result.current.pending).toEqual(action))

      await act(() => result.current.handleReject())

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionResult: expect.objectContaining({
            status: 'error',
            error: 'User rejected',
          }),
        }),
      )
      expect(closeSpy).toHaveBeenCalled()
    })

    it('sets rejectFailureError when storeResult returns false (missing requestId)', async () => {
      const action = { windowId: 4 } // no requestId → storeResult returns false
      stubStorage(action)
      const closeSpy = vi
        .spyOn(window, 'close')
        .mockImplementation(() => undefined)
      const { result } = renderHook(() => usePendingSignAction(makeOptions()))
      await waitFor(() => expect(result.current.pending).toEqual(action))

      await act(() => result.current.handleReject())

      expect(closeSpy).not.toHaveBeenCalled()
      expect(result.current.error).toBe('Reject failed')
    })
  })
})
