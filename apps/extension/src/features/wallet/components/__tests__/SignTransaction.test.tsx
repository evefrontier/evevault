import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockUseTransactionSigning } = vi.hoisted(() => ({
  mockUseTransactionSigning: vi.fn(),
}))

vi.mock('@/features/wallet/hooks', () => ({
  useTransactionSigning: mockUseTransactionSigning,
}))

vi.mock('@/features/wallet/components/SignRequestView', () => ({
  SignRequestView: ({
    title,
    hasPending,
    loadingMessage,
    onApprove,
    onReject,
  }: {
    title: string
    hasPending: boolean
    loadingMessage: string
    children: React.ReactNode
    onApprove?: () => void
    onReject?: () => void
  }) => (
    <div>
      <span data-testid="title">{title}</span>
      {!hasPending && <span>{loadingMessage}</span>}
      <button data-testid="approve-btn" type="button" onClick={onApprove}>
        Approve
      </button>
      <button data-testid="reject-btn" type="button" onClick={onReject}>
        Reject
      </button>
    </div>
  ),
}))

vi.mock('@/features/wallet/components/TransactionRiskPanel', () => ({
  TransactionRiskPanel: () => null,
}))

vi.mock('@evevault/shared/components', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@evevault/shared/components')>()
  return {
    ...actual,
    Text: ({ children }: { children: React.ReactNode }) => (
      <span>{children}</span>
    ),
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  mockUseTransactionSigning.mockReturnValue({
    pendingTransaction: null,
    loading: false,
    error: null,
    auth: {},
    handleReject: vi.fn(),
    withSigning: vi.fn(),
    storeResult: vi.fn(),
    suiClient: {},
  })
})

import SignTransaction from '../SignTransaction'

const PENDING_TX = {
  windowId: 1,
  requestId: 'r1',
  reviewValue: { commands: [], inputs: [] },
  displayValue: '{}',
  chain: 'sui:testnet',
  account: { address: '0xabc' },
}

describe('SignTransaction', () => {
  it('renders loading state when there is no pending transaction', () => {
    render(<SignTransaction />)
    expect(screen.getByText('Loading transaction...')).toBeInTheDocument()
  })

  it('renders with the correct title', () => {
    render(<SignTransaction />)
    expect(screen.getByTestId('title')).toHaveTextContent('Sign Transaction')
  })

  it('calls storeResult with signed status when onSign is triggered', async () => {
    const storeResult = vi.fn(() => Promise.resolve(true))
    const withSigning = vi.fn().mockImplementation(async (cb) => {
      await cb({ bytes: 'b64bytes', signature: 'mysig', txb: {}, windowId: 1 })
    })
    mockUseTransactionSigning.mockReturnValue({
      pendingTransaction: PENDING_TX,
      loading: false,
      error: null,
      auth: {},
      handleReject: vi.fn(),
      withSigning,
      storeResult,
      suiClient: {},
    })
    render(<SignTransaction />)
    fireEvent.click(screen.getByTestId('approve-btn'))
    await waitFor(() => {
      expect(storeResult).toHaveBeenCalledWith({
        status: 'signed',
        bytes: 'b64bytes',
        signature: 'mysig',
      })
    })
  })

  it('throws when storeResult returns false', async () => {
    const storeResult = vi.fn(() => Promise.resolve(false))
    const withSigning = vi.fn().mockImplementation(async (cb) => {
      await expect(
        cb({ bytes: 'b64bytes', signature: 'mysig', txb: {}, windowId: 1 }),
      ).rejects.toThrow('Failed to record the signing result')
    })
    mockUseTransactionSigning.mockReturnValue({
      pendingTransaction: PENDING_TX,
      loading: false,
      error: null,
      auth: {},
      handleReject: vi.fn(),
      withSigning,
      storeResult,
      suiClient: {},
    })
    render(<SignTransaction />)
    fireEvent.click(screen.getByTestId('approve-btn'))
    await waitFor(() => {
      expect(storeResult).toHaveBeenCalled()
    })
  })
})
