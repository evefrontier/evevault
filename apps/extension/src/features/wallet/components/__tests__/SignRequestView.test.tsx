import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SignRequestView } from '../SignRequestView'

vi.mock('@/features/wallet/components/SignPopupAuthGate', () => ({
  SignPopupAuthGate: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

vi.mock('@evevault/shared/components', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@evevault/shared/components')>()
  return {
    ...actual,
    Button: ({
      children,
      onClick,
      disabled,
    }: {
      children: React.ReactNode
      onClick?: () => void
      disabled?: boolean
    }) => (
      <button type="button" onClick={onClick} disabled={disabled}>
        {children}
      </button>
    ),
    Checkbox: ({
      text,
      isChecked,
      onChange,
      isDisabled,
      name,
    }: {
      text?: string
      isChecked?: boolean
      onChange?: (v: boolean) => void
      isDisabled?: boolean
      name?: string
    }) => (
      <label>
        <input
          type="checkbox"
          name={name}
          checked={isChecked ?? false}
          onChange={(e) => onChange?.(e.target.checked)}
          disabled={isDisabled}
        />
        {text}
      </label>
    ),
  }
})

const AUTH_STUB = {
  isLocked: false,
  lockChecked: true,
  isPinSet: true,
  unlock: vi.fn(),
  user: { id_token: 'tok' },
  loading: false,
  login: vi.fn(),
}

function defaultProps(overrides = {}) {
  return {
    auth: AUTH_STUB,
    title: 'Sign Transaction',
    hasPending: true,
    loading: false,
    error: null,
    loadingMessage: 'Loading transaction...',
    onApprove: vi.fn(),
    onReject: vi.fn(),
    children: <div>Tx payload</div>,
    ...overrides,
  }
}

describe('SignRequestView', () => {
  it('shows loadingMessage when hasPending is false', () => {
    render(<SignRequestView {...defaultProps({ hasPending: false })} />)
    expect(screen.getByText('Loading transaction...')).toBeInTheDocument()
  })

  it('shows error alongside loadingMessage when hasPending is false', () => {
    render(
      <SignRequestView
        {...defaultProps({ hasPending: false, error: 'Something went wrong' })}
      />,
    )
    expect(screen.getByText('Loading transaction...')).toBeInTheDocument()
    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument()
  })

  it('shows Approve and Reject buttons when hasPending is true', () => {
    render(<SignRequestView {...defaultProps()} />)
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument()
  })

  it('shows "Signing..." text on Approve button while loading', () => {
    render(<SignRequestView {...defaultProps({ loading: true })} />)
    expect(
      screen.getByRole('button', { name: 'Signing...' }),
    ).toBeInTheDocument()
  })

  it('disables Approve while loading', () => {
    render(<SignRequestView {...defaultProps({ loading: true })} />)
    expect(screen.getByRole('button', { name: 'Signing...' })).toBeDisabled()
  })

  it('Approve is enabled when requireAcknowledgement is false', () => {
    render(
      <SignRequestView {...defaultProps({ requireAcknowledgement: false })} />,
    )
    expect(screen.getByRole('button', { name: 'Approve' })).not.toBeDisabled()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('Approve is disabled until the keeper lock state is confirmed', () => {
    render(
      <SignRequestView
        {...defaultProps({ auth: { ...AUTH_STUB, lockChecked: false } })}
      />,
    )
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled()
  })

  it('Approve is disabled when requireAcknowledgement is true and not yet acknowledged', () => {
    render(
      <SignRequestView {...defaultProps({ requireAcknowledgement: true })} />,
    )
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled()
  })

  it('Approve becomes enabled after the acknowledgement checkbox is ticked', () => {
    render(
      <SignRequestView {...defaultProps({ requireAcknowledgement: true })} />,
    )
    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)
    expect(screen.getByRole('button', { name: 'Approve' })).not.toBeDisabled()
  })

  it('shows inline error text when hasPending is true and error is set', () => {
    render(<SignRequestView {...defaultProps({ error: 'Signing failed' })} />)
    expect(screen.getByText('Error: Signing failed')).toBeInTheDocument()
  })

  it('renders children inside the pending view', () => {
    render(<SignRequestView {...defaultProps()} />)
    expect(screen.getByText('Tx payload')).toBeInTheDocument()
  })

  it('calls onApprove when Approve is clicked', () => {
    const onApprove = vi.fn()
    render(<SignRequestView {...defaultProps({ onApprove })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    expect(onApprove).toHaveBeenCalledTimes(1)
  })

  it('calls onReject when Reject is clicked', () => {
    const onReject = vi.fn()
    render(<SignRequestView {...defaultProps({ onReject })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    expect(onReject).toHaveBeenCalledTimes(1)
  })

  it('shows a custom acknowledgement label', () => {
    render(
      <SignRequestView
        {...defaultProps({
          requireAcknowledgement: true,
          acknowledgementLabel: 'I accept the risk',
        })}
      />,
    )
    expect(screen.getByText('I accept the risk')).toBeInTheDocument()
  })
})
