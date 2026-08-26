import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockUseTransactionSigning, mockUseTransactionSimulation } = vi.hoisted(
  () => ({
    mockUseTransactionSigning: vi.fn(),
    mockUseTransactionSimulation: vi.fn(),
  }),
)

vi.mock('@/features/wallet/hooks', () => ({
  useTransactionSigning: mockUseTransactionSigning,
  useTransactionSimulation: mockUseTransactionSimulation,
}))

vi.mock('@evevault/shared/wallet', () => ({
  useWalletSigningContext: () => ({ suiClient: {}, chain: 'sui:testnet' }),
}))

vi.mock('@/features/wallet/components/TransactionSimulationPanel', () => ({
  TransactionSimulationPanel: ({ state }: { state: unknown }) => (
    <div data-testid="simulation-panel">{JSON.stringify(state)}</div>
  ),
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
  mockUseTransactionSimulation.mockReturnValue(null)
})

describe('SignTransactionFlow', () => {
  it('shows loading state when there is no pending transaction', () => {
    stubSigning()
    render(<SignTransactionFlow title="Sign Transaction" onSign={vi.fn()} />)
    expect(screen.getByText('Loading transaction...')).toBeInTheDocument()
  })

  it('renders Outcome and Payload tabs, Outcome active, when pending', () => {
    stubSigning({
      pendingTransaction: {
        windowId: 1,
        requestId: 'r1',
        reviewValue: { commands: [], inputs: [] }, // no findings → no Warnings tab
        displayValue: '{"test":true}',
        chain: 'sui:testnet',
        dapp: undefined,
        account: { address: '0xabc' },
      },
    })
    render(<SignTransactionFlow title="Sign Transaction" onSign={vi.fn()} />)
    expect(screen.getByRole('tab', { name: 'Outcome' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Payload' })).toBeInTheDocument()
    expect(
      screen.queryByRole('tab', { name: /Warnings/ }),
    ).not.toBeInTheDocument()
    // Outcome is the default tab, so its content is mounted.
    expect(screen.getByTestId('simulation-panel')).toBeInTheDocument()
  })

  it('adds a Warnings tab that reveals the risk panel when there are findings', () => {
    stubSigning({
      pendingTransaction: {
        windowId: 1,
        requestId: 'r1',
        reviewValue: { commands: [{ MoveCall: {} }], inputs: [] }, // warning finding
        displayValue: '{}',
        chain: 'sui:testnet',
        account: { address: '0xabc' },
      },
    })
    render(<SignTransactionFlow title="Sign Transaction" onSign={vi.fn()} />)
    const warningsTab = screen.getByRole('tab', { name: /Warnings/ })
    expect(warningsTab).toBeInTheDocument()
    // Risk panel lives in the (inactive) Warnings tab until it's selected.
    expect(screen.queryByTestId('risk-panel')).not.toBeInTheDocument()
    fireEvent.click(warningsTab)
    expect(screen.getByTestId('risk-panel')).toBeInTheDocument()
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

  it('requires acknowledgement when the simulation predicts failure', () => {
    stubSigning({
      pendingTransaction: {
        windowId: 1,
        requestId: 'r1',
        reviewValue: { commands: [], inputs: [] }, // clean static review
        displayValue: '{}',
        chain: 'sui:testnet',
        account: { address: '0xabc' },
      },
    })
    mockUseTransactionSimulation.mockReturnValue({
      status: 'ready',
      simulation: {
        status: 'failure',
        error: 'MoveAbort',
        digest: 'd',
        gas: { computation: '0', storage: '0', rebate: '0', net: '0.001' },
        balanceChanges: [],
        changedObjects: [],
        events: [],
      },
    })
    render(<SignTransactionFlow title="Sign Transaction" onSign={vi.fn()} />)
    expect(screen.getByTestId('ack-required')).toBeInTheDocument()
  })

  it('does not require acknowledgement when the simulation succeeds', () => {
    stubSigning({
      pendingTransaction: {
        windowId: 1,
        requestId: 'r1',
        reviewValue: { commands: [], inputs: [] },
        displayValue: '{}',
        chain: 'sui:testnet',
        account: { address: '0xabc' },
      },
    })
    mockUseTransactionSimulation.mockReturnValue({
      status: 'ready',
      simulation: {
        status: 'success',
        digest: 'd',
        gas: { computation: '0', storage: '0', rebate: '0', net: '0.001' },
        balanceChanges: [],
        changedObjects: [],
        events: [],
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
