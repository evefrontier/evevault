import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockUsePendingTransaction, mockUseWalletSigningContext, mockPrepare } =
  vi.hoisted(() => ({
    mockUsePendingTransaction: vi.fn(),
    mockUseWalletSigningContext: vi.fn(),
    mockPrepare: vi.fn(),
  }))

vi.mock('@/features/wallet/hooks/usePendingTransaction', () => ({
  usePendingTransaction: mockUsePendingTransaction,
}))

vi.mock('@evevault/shared/wallet', () => ({
  useWalletSigningContext: mockUseWalletSigningContext,
}))

vi.mock('@/features/wallet/transactionSigning', () => ({
  prepareAndSignTransaction: mockPrepare,
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

const SIGNING_CONTEXT_STUB = {
  getSenderAddress: vi.fn(),
  isLocalnet: false,
  sign: vi.fn(),
  suiClient: {},
}

const PENDING_TX_STUB = {
  windowId: 1,
  requestId: 'req-1',
  transaction: 'base64tx',
  chain: 'sui:testnet',
  account: { address: '0xabc' },
}

function stubPendingTransaction(overrides: Record<string, unknown> = {}) {
  const setLoading = vi.fn()
  const setError = vi.fn()
  const handleReject = vi.fn()
  const storeResult = vi.fn(() => Promise.resolve(true))
  const storeErrorResult = vi.fn(() => Promise.resolve(true))

  mockUsePendingTransaction.mockReturnValue({
    pendingTransaction: PENDING_TX_STUB,
    loading: false,
    setLoading,
    error: null,
    setError,
    auth: { user: { id_token: 'tok' } },
    handleReject,
    storeResult,
    storeErrorResult,
    ...overrides,
  })

  return { setLoading, setError, handleReject, storeResult, storeErrorResult }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseWalletSigningContext.mockReturnValue(SIGNING_CONTEXT_STUB)
  vi.spyOn(window, 'close').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

import { useTransactionSigning } from '../useTransactionSigning'

describe('useTransactionSigning', () => {
  describe('hook shape', () => {
    it('exposes pendingTransaction, loading, error, auth, handleReject, withSigning, storeResult, suiClient', () => {
      stubPendingTransaction()
      const { result } = renderHook(() => useTransactionSigning())

      expect(result.current).toMatchObject({
        pendingTransaction: PENDING_TX_STUB,
        loading: false,
        error: null,
        withSigning: expect.any(Function),
        storeResult: expect.any(Function),
        handleReject: expect.any(Function),
      })
      expect(result.current.suiClient).toBe(SIGNING_CONTEXT_STUB.suiClient)
    })
  })

  describe('withSigning', () => {
    it('does nothing when there is no pending transaction', async () => {
      stubPendingTransaction({ pendingTransaction: null })
      const { result } = renderHook(() => useTransactionSigning())

      await act(() => result.current.withSigning(vi.fn()))

      expect(mockPrepare).not.toHaveBeenCalled()
    })

    it('calls prepareAndSignTransaction and invokes onSigned on success', async () => {
      const { setLoading, setError } = stubPendingTransaction()
      const signResult = { bytes: 'b', signature: 's', txb: {} }
      mockPrepare.mockResolvedValue(signResult)

      const onSigned = vi.fn(() => Promise.resolve())
      const { result } = renderHook(() => useTransactionSigning())

      await act(() => result.current.withSigning(onSigned))

      expect(setLoading).toHaveBeenCalledWith(true)
      expect(setError).toHaveBeenCalledWith(null)
      expect(mockPrepare).toHaveBeenCalledWith(
        expect.objectContaining({
          pendingTransaction: PENDING_TX_STUB,
          auth: expect.objectContaining({ user: { id_token: 'tok' } }),
          isLocalnet: SIGNING_CONTEXT_STUB.isLocalnet,
          sign: SIGNING_CONTEXT_STUB.sign,
          suiClient: SIGNING_CONTEXT_STUB.suiClient,
        }),
      )
      expect(onSigned).toHaveBeenCalledWith(signResult)
      expect(setLoading).toHaveBeenLastCalledWith(false)
    })

    it('sets error and stores error result when prepareAndSignTransaction throws', async () => {
      const { setLoading, setError, storeErrorResult } =
        stubPendingTransaction()
      mockPrepare.mockRejectedValue(new Error('signing failed'))

      const onSigned = vi.fn()
      const { result } = renderHook(() => useTransactionSigning())

      await act(() => result.current.withSigning(onSigned))

      expect(setError).toHaveBeenCalledWith('signing failed')
      expect(storeErrorResult).toHaveBeenCalledWith('signing failed')
      expect(setLoading).toHaveBeenLastCalledWith(false)
      expect(onSigned).not.toHaveBeenCalled()
    })

    it('uses "Unknown error occurred" message for non-Error throws', async () => {
      const { setError, storeErrorResult } = stubPendingTransaction()
      mockPrepare.mockRejectedValue('plain string error')

      const { result } = renderHook(() => useTransactionSigning())

      await act(() => result.current.withSigning(vi.fn()))

      expect(setError).toHaveBeenCalledWith('Unknown error occurred')
      expect(storeErrorResult).toHaveBeenCalledWith('Unknown error occurred')
    })
  })
})
