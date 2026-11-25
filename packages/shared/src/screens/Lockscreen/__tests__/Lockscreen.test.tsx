import { TenantId } from '@evefrontier/wallet-core/tenant'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const mockDevice = vi.hoisted(() => ({
  initialize: vi.fn(),
  error: null as string | null,
}))

vi.mock('#/hooks/useDevice', () => ({
  useDevice: () => mockDevice,
}))

vi.mock('#/stores/tenantStore', () => ({
  getCurrentTenantId: () => TenantId.STILLNESS,
}))

vi.mock('#/components', async () => {
  const shell = await vi.importActual<typeof import('#/components/AuthShell')>(
    '#/components/AuthShell',
  )
  return {
    AuthShell: shell.AuthShell,
    AuthShellLink: shell.AuthShellLink,
    AuthShellVersion: shell.AuthShellVersion,
    AuthMark: shell.AuthMark,
    Button: ({ children }: { children: React.ReactNode }) => (
      <button type="submit">{children}</button>
    ),
    Heading: ({ children }: { children: React.ReactNode }) => (
      <h2>{children}</h2>
    ),
    Text: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
    ResetVaultDialog: ({ isOpen }: { isOpen: boolean }) =>
      isOpen ? <div role="dialog">Reset vault?</div> : null,
    SignInContextLine: () => <div>Server · Network</div>,
  }
})

import { LockScreen } from '../Lockscreen'

describe('LockScreen', () => {
  it('shows the locked top bar and the version in the footer', () => {
    render(<LockScreen isPinSet unlock={vi.fn()} version="0.0.13" />)

    expect(screen.getByText('Locked')).toBeInTheDocument()
    expect(screen.getByAltText('EVE Vault')).toBeInTheDocument()
    expect(screen.getByText('v0.0.13')).toBeInTheDocument()
  })

  it('opens the reset dialog from the footer link', () => {
    render(<LockScreen isPinSet unlock={vi.fn()} />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Forgot PIN? Reset vault' }),
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('leaves out the footer when there is no PIN, no error and no version', () => {
    const { container } = render(
      <LockScreen isPinSet={false} unlock={vi.fn()} />,
    )

    expect(container.querySelector('footer')).toBeNull()
  })
})
