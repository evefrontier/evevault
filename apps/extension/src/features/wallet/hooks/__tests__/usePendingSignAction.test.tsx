import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  lockChecked: true,
  isPinSet: true,
  unlock: vi.fn(),
  lock: vi.fn(() => Promise.resolve()),
  user: { id_token: 'tok' },
  loading: false,
  login: vi.fn(),
  ephemeralPublicKey: {},
  maxEpoch: 100,
  getZkProof: vi.fn(),
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
  vi.stubGlobal('browser', {
    storage: {
      local: {
        get: vi.fn(() => Promise.resolve({ pendingAction })),
        set: vi.fn(() => Promise.resolve()),
      },
    },
  } as unknown as typeof browser)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseSignPopupAuth.mockReturnValue(AUTH_STUB)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
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

    it('sets pending after parsePending resolves with the transformed value', async () => {
      const raw = { windowId: 1, requestId: 'req-1' }
      stubStorage(raw)
      const parsePending = vi.fn(async (input: unknown) => ({
        ...(input as object),
        parsed: true as const,
      }))
      const { result } = renderHook(() =>
        usePendingSignAction(makeOptions(parsePending)),
      )

      await waitFor(() =>
        expect(result.current.pending).toEqual({ ...raw, parsed: true }),
      )
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

    it('sets error when browser.storage.local.get rejects', async () => {
      vi.stubGlobal('browser', {
        storage: {
          local: {
            get: vi.fn(() => Promise.reject(new Error('idb crash'))),
          },
        },
      } as unknown as typeof browser)

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
      expect(browser.storage.local.set).not.toHaveBeenCalled()
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
      expect(browser.storage.local.set).not.toHaveBeenCalled()
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
      expect(browser.storage.local.set).toHaveBeenCalledWith({
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
      expect(browser.storage.local.set).toHaveBeenCalledWith({
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

      expect(browser.storage.local.set).not.toHaveBeenCalled()
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

      expect(browser.storage.local.set).toHaveBeenCalledWith({
        transactionResult: {
          status: 'error',
          error: 'User rejected',
          windowId: 2,
          requestId: 'req-close',
        },
      })
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

  describe('recoverIfLocked', () => {
    it('locks the vault and reports handled for the keeper locked error', async () => {
      const action = { windowId: 1, requestId: 'req-lock' }
      stubStorage(action)
      const { result } = renderHook(() => usePendingSignAction(makeOptions()))
      await waitFor(() => expect(result.current.pending).toEqual(action))

      let handled: boolean | undefined
      await act(async () => {
        handled = await result.current.recoverIfLocked(
          '[KEEPER_EPH_SIGN] LOCKED',
        )
      })

      expect(handled).toBe(true)
      expect(AUTH_STUB.lock).toHaveBeenCalledTimes(1)
      // The dApp request must stay pending, so no error result is written.
      expect(browser.storage.local.set).not.toHaveBeenCalled()
      expect(result.current.error).toBeNull()
    })

    it('does not handle unrelated errors', async () => {
      const action = { windowId: 1, requestId: 'req-other' }
      stubStorage(action)
      const { result } = renderHook(() => usePendingSignAction(makeOptions()))
      await waitFor(() => expect(result.current.pending).toEqual(action))

      let handled: boolean | undefined
      await act(async () => {
        handled = await result.current.recoverIfLocked('some other failure')
      })

      expect(handled).toBe(false)
      expect(AUTH_STUB.lock).not.toHaveBeenCalled()
    })
  })
})
