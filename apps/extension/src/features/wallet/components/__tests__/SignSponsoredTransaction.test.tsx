import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getSponsoredApproveError,
  parsePendingSponsoredAction,
} from '../SignSponsoredTransaction'

const {
  mockUsePendingSignAction,
  mockUseWalletSigningContext,
  mockAddressAliasModule,
} = vi.hoisted(() => ({
  mockUsePendingSignAction: vi.fn(),
  mockUseWalletSigningContext: vi.fn(),
  mockAddressAliasModule: '0xaddress_alias_module',
}))

vi.mock('@/features/wallet/hooks', () => ({
  usePendingSignAction: mockUsePendingSignAction,
  useTransactionSimulation: () => null,
}))

vi.mock('@/features/wallet/components/TransactionSimulationPanel', () => ({
  TransactionSimulationPanel: () => null,
}))

vi.mock('@evevault/shared/wallet', () => ({
  useWalletSigningContext: mockUseWalletSigningContext,
  ADDRESS_ALIAS_MODULE: mockAddressAliasModule,
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
    parseTransactionBytes: vi.fn(async () => ({
      displayValue: '{}',
      reviewValue: { commands: [] },
    })),
  }
})

vi.mock('@/features/wallet/components/SignRequestView', () => ({
  SignRequestView: ({
    children,
    hasPending,
    loadingMessage,
    error,
    requireAcknowledgement,
    onApprove,
    onReject,
  }: {
    children: React.ReactNode
    hasPending: boolean
    loadingMessage: string
    error: string | null
    requireAcknowledgement?: boolean
    onApprove?: () => void
    onReject?: () => void
  }) => (
    <div>
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

const AUTH_STUB = {
  user: { id_token: 'tok' },
  ephemeralPublicKey: {},
  maxEpoch: 100,
  getZkProof: vi.fn(),
}

function stubPending(
  pending: Record<string, unknown> | null,
  overrides: Record<string, unknown> = {},
) {
  mockUsePendingSignAction.mockReturnValue({
    pending,
    loading: false,
    setLoading: vi.fn(),
    error: null,
    setError: vi.fn(),
    auth: AUTH_STUB,
    handleReject: vi.fn(),
    storeResult: vi.fn(() => Promise.resolve(true)),
    storeErrorResult: vi.fn(() => Promise.resolve(true)),
    ...overrides,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseWalletSigningContext.mockReturnValue({
    isLocalnet: false,
    sign: vi.fn(),
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

async function renderSignSponsored() {
  const { default: SignSponsoredTransaction } = await import(
    '../SignSponsoredTransaction'
  )
  return render(<SignSponsoredTransaction />)
}

describe('SignSponsoredTransaction', () => {
  it('shows loading state when there is no pending action', async () => {
    stubPending(null)
    await renderSignSponsored()
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows pending sponsored action details when loaded', async () => {
    stubPending({
      windowId: 1,
      requestId: 'req-1',
      sponsoredTxB64: btoa('bytes'),
      preparationId: 'prep-1',
      sponsoredAction: 'mine',
      assembly: 42,
      assemblyType: 'basic',
      chain: 'sui:testnet',
    })
    await renderSignSponsored()
    expect(screen.getByText('mine')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('basic')).toBeInTheDocument()
  })

  it('shows metadata fields when present', async () => {
    stubPending({
      windowId: 1,
      requestId: 'req-2',
      sponsoredTxB64: btoa('bytes'),
      preparationId: 'prep-2',
      metadata: {
        url: 'https://example.com',
        name: 'My Item',
        description: 'Desc',
      },
      chain: 'sui:testnet',
    })
    await renderSignSponsored()
    expect(screen.getByText('https://example.com')).toBeInTheDocument()
    expect(screen.getByText('My Item')).toBeInTheDocument()
    expect(screen.getByText('Desc')).toBeInTheDocument()
  })

  it('shows acknowledgement gate when parsed transaction cannot be verified', async () => {
    // reviewTransaction returns unverified (danger) for undefined reviewValue
    stubPending({
      windowId: 1,
      requestId: 'req-3',
      sponsoredTxB64: btoa('bytes'),
      preparationId: 'prep-3',
      reviewValue: undefined,
      chain: 'sui:testnet',
    })
    await renderSignSponsored()
    expect(screen.getByTestId('ack-required')).toBeInTheDocument()
  })

  it('does not require acknowledgement when riskFindings are empty', async () => {
    stubPending({
      windowId: 1,
      requestId: 'req-4',
      sponsoredTxB64: btoa('bytes'),
      preparationId: 'prep-4',
      reviewValue: { commands: [], inputs: [] },
      chain: 'sui:testnet',
    })
    await renderSignSponsored()
    expect(screen.queryByTestId('ack-required')).not.toBeInTheDocument()
  })
})

describe('SignSponsoredTransaction — signing', () => {
  beforeEach(() => {
    vi.spyOn(window, 'close').mockImplementation(() => {})
  })

  const PENDING_WITH_TX = {
    windowId: 1,
    requestId: 'sign-req',
    sponsoredTxB64: btoa('some bytes'),
    preparationId: 'prep-sign',
    reviewValue: { commands: [], inputs: [] },
    chain: 'sui:testnet' as const,
  }

  it('signs successfully and closes the window', async () => {
    const sign = vi.fn().mockResolvedValue({ signature: 'zksig' })
    const storeResult = vi.fn(() => Promise.resolve(true))
    mockUseWalletSigningContext.mockReturnValue({ isLocalnet: false, sign })
    stubPending(PENDING_WITH_TX, {
      storeResult,
      auth: {
        user: { id_token: 'tok' },
        ephemeralPublicKey: {},
        maxEpoch: 100,
      },
    })
    await renderSignSponsored()
    fireEvent.click(screen.getByTestId('approve-btn'))
    await waitFor(() => {
      expect(storeResult).toHaveBeenCalledWith({
        status: 'signed',
        zkSignature: 'zksig',
        preparationId: 'prep-sign',
      })
    })
    expect(window.close).toHaveBeenCalled()
  })

  it('sets error and does not close window when storeResult returns false', async () => {
    const sign = vi.fn().mockResolvedValue({ signature: 'zksig' })
    const storeResult = vi.fn(() => Promise.resolve(false))
    const setError = vi.fn()
    mockUseWalletSigningContext.mockReturnValue({ isLocalnet: false, sign })
    stubPending(PENDING_WITH_TX, {
      storeResult,
      setError,
      auth: {
        user: { id_token: 'tok' },
        ephemeralPublicKey: {},
        maxEpoch: 100,
      },
    })
    await renderSignSponsored()
    fireEvent.click(screen.getByTestId('approve-btn'))
    await waitFor(() => {
      expect(setError).toHaveBeenCalledWith(
        'Failed to record the signing result. Please try again.',
      )
    })
    expect(window.close).not.toHaveBeenCalled()
  })

  it('sets error when signing throws', async () => {
    const sign = vi.fn().mockRejectedValue(new Error('signing error'))
    const setError = vi.fn()
    const storeErrorResult = vi.fn(() => Promise.resolve(true))
    mockUseWalletSigningContext.mockReturnValue({ isLocalnet: false, sign })
    stubPending(PENDING_WITH_TX, {
      setError,
      storeErrorResult,
      auth: {
        user: { id_token: 'tok' },
        ephemeralPublicKey: {},
        maxEpoch: 100,
      },
    })
    await renderSignSponsored()
    fireEvent.click(screen.getByTestId('approve-btn'))
    await waitFor(() => {
      expect(setError).toHaveBeenCalledWith('signing error')
      expect(storeErrorResult).toHaveBeenCalledWith('signing error')
    })
  })

  it('sets validation error immediately when on localnet', async () => {
    const setError = vi.fn()
    mockUseWalletSigningContext.mockReturnValue({
      isLocalnet: true,
      sign: vi.fn(),
    })
    stubPending(PENDING_WITH_TX, {
      setError,
      auth: {
        user: { id_token: 'tok' },
        ephemeralPublicKey: {},
        maxEpoch: 100,
      },
    })
    await renderSignSponsored()
    fireEvent.click(screen.getByTestId('approve-btn'))
    await waitFor(() => {
      expect(setError).toHaveBeenCalledWith(
        'Sponsored transactions are not available on localnet.',
      )
    })
  })
})

describe('getSponsoredApproveError', () => {
  const VALID_AUTH = { user: {}, ephemeralPublicKey: {}, maxEpoch: 100 }

  it('returns null when all fields are valid', () => {
    expect(getSponsoredApproveError(false, VALID_AUTH)).toBeNull()
  })

  it('returns localnet error before auth checks', () => {
    expect(getSponsoredApproveError(true, VALID_AUTH)).toBe(
      'Sponsored transactions are not available on localnet.',
    )
  })

  it('returns sign-in error when user is missing', () => {
    expect(getSponsoredApproveError(false, { ...VALID_AUTH, user: null })).toBe(
      'Sign in and try again.',
    )
  })

  it('returns device-key error when ephemeralPublicKey is missing', () => {
    expect(
      getSponsoredApproveError(false, {
        ...VALID_AUTH,
        ephemeralPublicKey: null,
      }),
    ).toBe('Device key not found. Unlock the wallet and try again.')
  })

  it('returns re-auth error when maxEpoch is 0', () => {
    expect(
      getSponsoredApproveError(false, { ...VALID_AUTH, maxEpoch: 0 }),
    ).toBe('Max epoch not set. Re-authenticate and try again.')
  })
})

describe('parsePendingSponsoredAction', () => {
  it('throws when sponsoredTxB64 is missing', async () => {
    await expect(
      parsePendingSponsoredAction({ preparationId: 'prep-1' }),
    ).rejects.toThrow('No pending sponsored transaction found')
  })

  it('throws when preparationId is missing', async () => {
    await expect(
      parsePendingSponsoredAction({ sponsoredTxB64: btoa('bytes') }),
    ).rejects.toThrow('No pending sponsored transaction found')
  })

  it('throws when both sponsoredTxB64 and preparationId are missing', async () => {
    await expect(parsePendingSponsoredAction({})).rejects.toThrow(
      'No pending sponsored transaction found',
    )
  })
})
