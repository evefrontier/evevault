import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockUseTransactionSigning } = vi.hoisted(() => ({
  mockUseTransactionSigning: vi.fn(),
}))

vi.mock('@/features/wallet/hooks', () => ({
  useTransactionSigning: mockUseTransactionSigning,
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
  TransactionRiskPanel: ({ findings }: { findings: unknown[] }) => (
    <div data-testid="risk-panel">{findings.length} findings</div>
  ),
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

function stubSigning(overrides: Record<string, unknown> = {}) {
  mockUseTransactionSigning.mockReturnValue({
    pendingTransaction: null,
    loading: false,
    error: null,
    auth: {},
    handleReject: vi.fn(),
    withSigning: vi.fn(),
    storeResult: vi.fn(),
    suiClient: {},
    ...overrides,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SignTransactionFlow', () => {
  it('shows loading state when there is no pending transaction', () => {
    stubSigning()
    render(<SignTransactionFlow title="Sign Transaction" onSign={vi.fn()} />)
    expect(screen.getByText('Loading transaction...')).toBeInTheDocument()
  })

  it('shows the risk panel and payload label when a transaction is pending', () => {
    stubSigning({
      pendingTransaction: {
        windowId: 1,
        requestId: 'r1',
        reviewValue: { commands: [], inputs: [] },
        displayValue: '{"test":true}',
        chain: 'sui:testnet',
        dapp: undefined,
        account: { address: '0xabc' },
      },
    })
    render(<SignTransactionFlow title="Sign Transaction" onSign={vi.fn()} />)
    expect(screen.getByTestId('risk-panel')).toBeInTheDocument()
    expect(screen.getByText('Transaction payload')).toBeInTheDocument()
  })

  it('requires acknowledgement for danger-class findings', () => {
    stubSigning({
      pendingTransaction: {
        windowId: 1,
        requestId: 'r1',
        reviewValue: undefined, // → unverified → danger
        displayValue: '{}',
        chain: 'sui:testnet',
        account: { address: '0xabc' },
      },
    })
    render(<SignTransactionFlow title="Sign Transaction" onSign={vi.fn()} />)
    expect(screen.getByTestId('ack-required')).toBeInTheDocument()
  })

  it('does not require acknowledgement for warning-only findings', () => {
    stubSigning({
      pendingTransaction: {
        windowId: 1,
        requestId: 'r1',
        reviewValue: { commands: [{ MoveCall: {} }], inputs: [] },
        displayValue: '{}',
        chain: 'sui:testnet',
        account: { address: '0xabc' },
      },
    })
    render(<SignTransactionFlow title="Sign Transaction" onSign={vi.fn()} />)
    expect(screen.queryByTestId('ack-required')).not.toBeInTheDocument()
  })

  it('passes the title through to SignRequestView', () => {
    stubSigning()
    render(<SignTransactionFlow title="Custom Title" onSign={vi.fn()} />)
    expect(screen.getByTestId('title')).toHaveTextContent('Custom Title')
  })

  it('calls handleReject when Reject is clicked', () => {
    const handleReject = vi.fn()
    stubSigning({
      pendingTransaction: {
        windowId: 1,
        requestId: 'r1',
        reviewValue: { commands: [], inputs: [] },
        displayValue: '{}',
        chain: 'sui:testnet',
        account: { address: '0xabc' },
      },
      handleReject,
    })
    render(<SignTransactionFlow title="Sign Transaction" onSign={vi.fn()} />)
    fireEvent.click(screen.getByTestId('reject-btn'))
    expect(handleReject).toHaveBeenCalledTimes(1)
  })

  it('calls withSigning (via handleApprove) when Approve is clicked', () => {
    const withSigning = vi.fn()
    stubSigning({
      pendingTransaction: {
        windowId: 1,
        requestId: 'r1',
        reviewValue: { commands: [], inputs: [] },
        displayValue: '{}',
        chain: 'sui:testnet',
        account: { address: '0xabc' },
      },
      withSigning,
    })
    const onSign = vi.fn()
    render(<SignTransactionFlow title="Sign Transaction" onSign={onSign} />)
    fireEvent.click(screen.getByTestId('approve-btn'))
    expect(withSigning).toHaveBeenCalledWith(expect.any(Function))
  })
})

// Keep the import here so vi.mock hoisting works correctly with dynamic import below
import { SignTransactionFlow } from '../SignTransactionFlow'
