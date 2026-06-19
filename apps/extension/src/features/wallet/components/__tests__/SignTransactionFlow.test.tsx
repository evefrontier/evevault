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
    hasPending,
    loadingMessage,
    requireAcknowledgement,
    title,
    onApprove,
    onReject,
  }: {
    children: React.ReactNode
    hasPending: boolean
    loadingMessage: string
    requireAcknowledgement?: boolean
    title: string
    onApprove?: () => void
    onReject?: () => void
  }) => (
    <div>
      <span data-testid="title">{title}</span>
      {!hasPending ? <span>{loadingMessage}</span> : children}
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

  it('shows the transaction payload when pending', () => {
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
