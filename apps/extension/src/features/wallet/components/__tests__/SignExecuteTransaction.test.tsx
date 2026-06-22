import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockUseTransactionSigning, mockUseWalletSigningContext } = vi.hoisted(
  () => ({
    mockUseTransactionSigning: vi.fn(),
    mockUseWalletSigningContext: vi.fn(),
  }),
)

vi.mock('@/features/wallet/hooks', () => ({
  useTransactionSigning: mockUseTransactionSigning,
}))

vi.mock('@evevault/shared/wallet', () => ({
  useWalletSigningContext: mockUseWalletSigningContext,
}))

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}))

vi.mock('@/features/wallet/components/parseExecResult', () => ({
  parseExecResult: vi.fn(() => ({
    digest: 'digest123',
    effects: 'effects123',
  })),
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

const defaultSuiClient = {
  executeTransaction: vi.fn(() => Promise.resolve({})),
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseWalletSigningContext.mockReturnValue({
    suiClient: defaultSuiClient,
    isLocalnet: false,
    sign: vi.fn(),
  })
  mockUseTransactionSigning.mockReturnValue({
    pendingTransaction: null,
    loading: false,
    error: null,
    auth: {},
    handleReject: vi.fn(),
    withSigning: vi.fn(),
    storeResult: vi.fn(),
    suiClient: defaultSuiClient,
  })
})

import SignAndExecuteTransaction from '../SignExecuteTransaction'

describe('SignAndExecuteTransaction', () => {
  it('renders loading state when there is no pending transaction', () => {
    render(<SignAndExecuteTransaction />)
    expect(screen.getByText('Loading transaction...')).toBeInTheDocument()
  })

  it('renders with the correct title', () => {
    render(<SignAndExecuteTransaction />)
    expect(screen.getByTestId('title')).toHaveTextContent(
      'Sign and Execute Transaction',
    )
  })

  it('executes transaction and stores result when onSign is triggered', async () => {
    const storeResult = vi.fn(() => Promise.resolve(true))
    const execSuiClient = {
      executeTransaction: vi.fn(() =>
        Promise.resolve({ digest: 'd', effects: { v2: {} } }),
      ),
    }
    mockUseWalletSigningContext.mockReturnValue({
      suiClient: execSuiClient,
      isLocalnet: false,
      sign: vi.fn(),
    })
    const withSigning = vi.fn().mockImplementation(async (cb) => {
      await cb({ bytes: 'b64', signature: 'sig', txb: {}, windowId: 1 })
    })
    mockUseTransactionSigning.mockReturnValue({
      pendingTransaction: {
        windowId: 1,
        requestId: 'r1',
        reviewValue: { commands: [], inputs: [] },
        displayValue: '{}',
        chain: 'sui:testnet',
        account: { address: '0xabc' },
      },
      loading: false,
      error: null,
      auth: {},
      handleReject: vi.fn(),
      withSigning,
      storeResult,
      suiClient: execSuiClient,
    })
    render(<SignAndExecuteTransaction />)
    fireEvent.click(screen.getByTestId('approve-btn'))
    await waitFor(() => {
      expect(storeResult).toHaveBeenCalledWith({
        status: 'signed_and_executed',
        bytes: 'b64',
        signature: 'sig',
        digest: 'digest123',
        effects: 'effects123',
      })
    })
  })

  it('sets error when storeResult returns false', async () => {
    const storeResult = vi.fn(() => Promise.resolve(false))
    const execSuiClient = {
      executeTransaction: vi.fn(() =>
        Promise.resolve({ digest: 'd', effects: { v2: {} } }),
      ),
    }
    mockUseWalletSigningContext.mockReturnValue({
      suiClient: execSuiClient,
      isLocalnet: false,
      sign: vi.fn(),
    })
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
      pendingTransaction: {
        windowId: 1,
        requestId: 'r1',
        reviewValue: { commands: [], inputs: [] },
        displayValue: '{}',
        chain: 'sui:testnet',
        account: { address: '0xabc' },
      },
      loading: false,
      error: null,
      auth: {},
      handleReject: vi.fn(),
      withSigning,
      storeResult,
      suiClient: execSuiClient,
    })
    render(<SignAndExecuteTransaction />)
    fireEvent.click(screen.getByTestId('approve-btn'))
    await waitFor(() => expect(capturedCb).toBeDefined())
    await expect(
      capturedCb!({ bytes: 'b64', signature: 'sig', txb: {}, windowId: 1 }),
    ).rejects.toThrow('Failed to record the signing result')
  })
})
