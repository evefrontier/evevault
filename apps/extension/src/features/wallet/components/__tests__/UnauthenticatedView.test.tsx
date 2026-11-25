import { ToastProvider } from '@evevault/shared/components'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { mockResetVaultOnDevice } = vi.hoisted(() => ({
  mockResetVaultOnDevice: vi.fn(),
}))

vi.mock('@evevault/shared/auth/resetVaultOnDevice', () => ({
  resetVaultOnDevice: () => mockResetVaultOnDevice(),
}))

import { UnauthenticatedView } from '../UnauthenticatedView'

/** Button renders its label twice (hover overlay), so match the text node. */
function clickButton(label: string) {
  const button = screen
    .getAllByText(label, { exact: true })[0]
    .closest('button')
  if (!button) throw new Error(`No button labelled ${label}`)
  fireEvent.click(button)
}

function renderView(onResetComplete = vi.fn()) {
  render(
    <ToastProvider>
      <UnauthenticatedView
        authLoading={false}
        availableTenantIds={['stillness']}
        tenantId="stillness"
        isPinSet
        devMode={false}
        onLoginClick={vi.fn()}
        onTenantChange={vi.fn()}
        onResetComplete={onResetComplete}
        onDevModeToggle={vi.fn()}
      />
    </ToastProvider>,
  )
  return { onResetComplete }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('UnauthenticatedView reset', () => {
  it('asks for confirmation instead of resetting on click', () => {
    renderView()

    fireEvent.click(screen.getByRole('button', { name: 'Reset vault' }))

    expect(
      screen.getByText('Reset EVE Vault on this device?'),
    ).toBeInTheDocument()
    expect(mockResetVaultOnDevice).not.toHaveBeenCalled()
  })

  it('resets only after the user confirms', async () => {
    mockResetVaultOnDevice.mockResolvedValue(undefined)
    const { onResetComplete } = renderView()

    fireEvent.click(screen.getByRole('button', { name: 'Reset vault' }))
    await act(async () => {
      clickButton('Reset')
    })

    expect(mockResetVaultOnDevice).toHaveBeenCalledTimes(1)
    expect(onResetComplete).toHaveBeenCalledTimes(1)
  })
})
