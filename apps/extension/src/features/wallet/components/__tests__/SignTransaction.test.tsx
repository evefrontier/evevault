import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockUseTransactionSigning } = vi.hoisted(() => ({
  mockUseTransactionSigning: vi.fn(),
}))

vi.mock('@/features/wallet/hooks', () => ({
  useTransactionSigning: mockUseTransactionSigning,
  useTransactionSimulation: () => null,
}))

vi.mock('@evevault/shared/wallet', () => ({
  useWalletSigningContext: () => ({ suiClient: {}, chain: 'sui:testnet' }),
}))

vi.mock('@/features/wallet/components/TransactionSimulationPanel', () => ({
  TransactionSimulationPanel: () => null,
}))

vi.mock('@/features/wallet/components/SignRequestView', () => ({
  SignRequestView: ({
    children,
    title,
    hasPending,
    loadingMessage,
    error,
    requireAcknowledgement,
    onApprove,
    onReject,
  }: {
    children: React.ReactNode
    title?: string
    hasPending: boolean
    loadingMessage: string
    error?: string | null
    requireAcknowledgement?: boolean
    onApprove?: () => void
    onReject?: () => void
  }) => (
    <div>
      {title && <span data-testid="title">{title}</span>}
      {!hasPending ? <span>{loadingMessage}</span> : children}
      {error && <span data-testid="error">{error}</span>}
      {requireAcknowledgement && (
        <span data-testid="ack-required">ack-required</span>
      )}
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

  it('sets error when storeResult returns false', async () => {
    const storeResult = vi.fn(() => Promise.resolve(false))
    let capturedCb:
      | ((result: Record<string, unknown>) => Promise<void>)
      | undefined
    const withSigning = vi
      .fn()
      .mockImplementation(
        async (cb: (r: Record<string, unknown>) => Promise<void>) => {
          capturedCb = cb
        },
      )
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
    await waitFor(() => expect(capturedCb).toBeDefined())
    await expect(
      capturedCb!({
        bytes: 'b64bytes',
        signature: 'mysig',
        txb: {},
        windowId: 1,
      }),
    ).rejects.toThrow('Failed to record the signing result')
    expect(storeResult).toHaveBeenCalledWith({
      status: 'signed',
      bytes: 'b64bytes',
      signature: 'mysig',
    })
  })
})
