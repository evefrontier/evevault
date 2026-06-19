import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockUsePendingSignAction, mockUseWalletSigningContext } = vi.hoisted(
  () => ({
    mockUsePendingSignAction: vi.fn(),
    mockUseWalletSigningContext: vi.fn(),
  }),
)

vi.mock('@/features/wallet/hooks', () => ({
  usePendingSignAction: mockUsePendingSignAction,
}))

vi.mock('@evevault/shared/wallet', () => ({
  useWalletSigningContext: mockUseWalletSigningContext,
}))

vi.mock('@/features/wallet/components/SignRequestView', () => ({
  SignRequestView: ({
    children,
    hasPending,
    loadingMessage,
    error,
    onApprove,
    onReject,
  }: {
    children: React.ReactNode
    hasPending: boolean
    loadingMessage: string
    error: string | null
    onApprove?: () => void
    onReject?: () => void
  }) => (
    <div>
      {!hasPending ? <span>{loadingMessage}</span> : children}
      {error && <span data-testid="error">{error}</span>}
      <button data-testid="approve-btn" type="button" onClick={onApprove}>
        Approve
      </button>
      <button data-testid="reject-btn" type="button" onClick={onReject}>
        Reject
      </button>
    </div>
  ),
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
    toErrorMessage: (e: unknown, fallback: string) =>
      e instanceof Error ? e.message : fallback,
  }
})

const AUTH_STUB = { user: {}, ephemeralPublicKey: {}, maxEpoch: 100 }

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
    chain: 'sui:testnet',
    isLocalnet: false,
    sign: vi.fn(),
  })
})

// Lazy import the component after mocks are set up
async function renderSignPersonalMessage() {
  const { default: SignPersonalMessage } = await import(
    '../SignPersonalMessage'
  )
  return render(<SignPersonalMessage />)
}

describe('SignPersonalMessage', () => {
  it('shows loading message when there is no pending message', async () => {
    stubPending(null)
    await renderSignPersonalMessage()
    expect(screen.getByText('Loading message...')).toBeInTheDocument()
  })

  it('decodes and renders a Uint8Array message', async () => {
    const message = new TextEncoder().encode('Hello world')
    stubPending({
      windowId: 1,
      requestId: 'r1',
      message,
      account: { address: '0xabc' },
    })
    await renderSignPersonalMessage()
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('decodes a number-array message (post-chrome-storage serialization)', async () => {
    const encoded = Array.from(new TextEncoder().encode('Array msg'))
    stubPending({
      windowId: 1,
      requestId: 'r1',
      message: encoded,
      account: { address: '0xabc' },
    })
    await renderSignPersonalMessage()
    expect(screen.getByText('Array msg')).toBeInTheDocument()
  })

  it('decodes a plain-object message with numeric keys', async () => {
    const text = 'Object msg'
    const bytes = new TextEncoder().encode(text)
    // chrome.storage serialises Uint8Array as { '0': 72, '1': 101, ... }
    const objectMsg = Object.fromEntries(
      [...bytes].map((v, i) => [String(i), v]),
    )
    stubPending({
      windowId: 1,
      requestId: 'r1',
      message: objectMsg,
      account: { address: '0xabc' },
    })
    await renderSignPersonalMessage()
    expect(screen.getByText(text)).toBeInTheDocument()
  })

  it('falls back to byte-count label for non-UTF-8 binary content', async () => {
    // Invalid UTF-8: lone continuation byte
    const message = new Uint8Array([0x80, 0x81, 0x82])
    stubPending({
      windowId: 1,
      requestId: 'r1',
      message,
      account: { address: '0xabc' },
    })
    await renderSignPersonalMessage()
    expect(screen.getByText(/\[binary message, 3 bytes\]/)).toBeInTheDocument()
  })
})

describe('SignPersonalMessage — signing', () => {
  beforeEach(() => {
    vi.spyOn(window, 'close').mockImplementation(() => {})
  })

  it('signs successfully and closes the window', async () => {
    const message = new TextEncoder().encode('hello')
    const storeResult = vi.fn(() => Promise.resolve(true))
    const sign = vi.fn().mockResolvedValue({ bytes: 'b64', signature: 'sig' })
    mockUseWalletSigningContext.mockReturnValue({
      chain: 'sui:testnet',
      isLocalnet: false,
      sign,
    })
    stubPending(
      { windowId: 1, requestId: 'r1', message, account: { address: '0xabc' } },
      {
        storeResult,
        auth: {
          user: { id_token: 'tok' },
          ephemeralPublicKey: {},
          maxEpoch: 100,
        },
      },
    )
    await renderSignPersonalMessage()
    fireEvent.click(screen.getByTestId('approve-btn'))
    await waitFor(() => {
      expect(storeResult).toHaveBeenCalledWith({
        status: 'signed',
        bytes: 'b64',
        signature: 'sig',
      })
    })
    expect(window.close).toHaveBeenCalled()
  })

  it('sets error when storeResult returns false', async () => {
    const message = new TextEncoder().encode('test')
    const setError = vi.fn()
    const storeResult = vi.fn(() => Promise.resolve(false))
    const sign = vi.fn().mockResolvedValue({ bytes: 'b', signature: 's' })
    mockUseWalletSigningContext.mockReturnValue({
      chain: 'sui:testnet',
      isLocalnet: false,
      sign,
    })
    stubPending(
      { windowId: 1, requestId: 'r1', message, account: { address: '0xabc' } },
      {
        setError,
        storeResult,
        auth: {
          user: { id_token: 'tok' },
          ephemeralPublicKey: {},
          maxEpoch: 100,
        },
      },
    )
    await renderSignPersonalMessage()
    fireEvent.click(screen.getByTestId('approve-btn'))
    await waitFor(() => {
      expect(setError).toHaveBeenCalledWith(
        'Failed to record the signing result. Please try again.',
      )
    })
  })

  it('sets error when signing fails', async () => {
    const setError = vi.fn()
    const storeErrorResult = vi.fn(() => Promise.resolve(true))
    const sign = vi.fn().mockRejectedValue(new Error('hw error'))
    const message = new TextEncoder().encode('test')
    mockUseWalletSigningContext.mockReturnValue({
      chain: 'sui:testnet',
      isLocalnet: false,
      sign,
    })
    stubPending(
      { windowId: 1, requestId: 'r1', message, account: { address: '0xabc' } },
      {
        setError,
        storeErrorResult,
        auth: {
          user: { id_token: 'tok' },
          ephemeralPublicKey: {},
          maxEpoch: 100,
        },
        loading: false,
      },
    )
    await renderSignPersonalMessage()
    fireEvent.click(screen.getByTestId('approve-btn'))
    await waitFor(() => {
      expect(setError).toHaveBeenCalledWith('hw error')
      expect(storeErrorResult).toHaveBeenCalledWith('hw error')
    })
  })
})
