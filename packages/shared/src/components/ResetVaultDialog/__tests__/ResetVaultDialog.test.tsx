import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { mockResetVaultOnDevice, mockShowToast } = vi.hoisted(() => ({
  mockResetVaultOnDevice: vi.fn(),
  mockShowToast: vi.fn(),
}))

vi.mock('#/auth/resetVaultOnDevice', () => ({
  resetVaultOnDevice: () => mockResetVaultOnDevice(),
}))

vi.mock('#/components/Toast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))

import { ResetVaultDialog } from '../ResetVaultDialog'

/** Button renders its label twice (hover overlay), so match the text node. */
function clickButton(label: string) {
  const button = screen
    .getAllByText(label, { exact: true })[0]
    .closest('button')
  if (!button) throw new Error(`No button labelled ${label}`)
  fireEvent.click(button)
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('ResetVaultDialog', () => {
  it('renders nothing while closed', () => {
    render(<ResetVaultDialog isOpen={false} onClose={vi.fn()} />)
    expect(
      screen.queryByText('Reset EVE Vault on this device?'),
    ).not.toBeInTheDocument()
  })

  it('does not reset when cancelled', () => {
    const onClose = vi.fn()
    render(<ResetVaultDialog isOpen onClose={onClose} />)

    clickButton('Cancel')

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(mockResetVaultOnDevice).not.toHaveBeenCalled()
  })

  it('resets, closes and reports completion on confirm', async () => {
    mockResetVaultOnDevice.mockResolvedValue(undefined)
    const onClose = vi.fn()
    const onResetComplete = vi.fn()
    render(
      <ResetVaultDialog
        isOpen
        onClose={onClose}
        onResetComplete={onResetComplete}
      />,
    )

    await act(async () => {
      clickButton('Reset')
    })

    expect(mockResetVaultOnDevice).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onResetComplete).toHaveBeenCalledTimes(1)
    expect(mockShowToast).not.toHaveBeenCalled()
  })

  it('stays open and shows a toast when the reset fails', async () => {
    mockResetVaultOnDevice.mockRejectedValue(new Error('IndexedDB blocked'))
    const onClose = vi.fn()
    const onResetComplete = vi.fn()
    render(
      <ResetVaultDialog
        isOpen
        onClose={onClose}
        onResetComplete={onResetComplete}
      />,
    )

    await act(async () => {
      clickButton('Reset')
    })

    expect(mockShowToast).toHaveBeenCalledWith(
      "Couldn't reset vault",
      'IndexedDB blocked',
    )
    expect(onClose).not.toHaveBeenCalled()
    expect(onResetComplete).not.toHaveBeenCalled()
  })
})
