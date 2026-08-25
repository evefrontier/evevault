import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UseRequireAliasResult } from '../useRequireAlias'

const mockSigningContext = vi.fn()
const mockEnabled = vi.fn()
const mockResolve = vi.fn()

vi.mock('#/wallet', () => ({
  useWalletSigningContext: () => mockSigningContext(),
  isAddressAliasEnforcementEnabled: () => mockEnabled(),
  resolveAliasEnforcementStatus: (...args: unknown[]) => mockResolve(...args),
}))

// Capture the props handed to the setup screen so tests can drive
// onComplete / onCancel without exercising the real registration flow.
let setupProps: { onComplete: () => void; onCancel: () => void } | null = null
vi.mock('../AliasRecoverySetupScreen', () => ({
  AliasRecoverySetupScreen: (props: {
    onComplete: () => void
    onCancel: () => void
  }) => {
    setupProps = props
    return null
  },
}))

// Render the modal's children only while open, mirroring the real Modal.
vi.mock('#/components', () => ({
  Modal: ({
    isOpen,
    children,
  }: {
    isOpen: boolean
    children: React.ReactNode
  }) => (isOpen ? children : null),
}))

import { useRequireAlias } from '../useRequireAlias'

const OWNER = `0x${'a'.repeat(64)}`

let api: UseRequireAliasResult
function Harness() {
  api = useRequireAlias()
  return <>{api.aliasSetupModal}</>
}

beforeEach(() => {
  setupProps = null
  mockSigningContext.mockReset().mockReturnValue({
    mode: 'zklogin',
    senderAddress: OWNER,
    chain: 'sui:testnet',
  })
  mockEnabled.mockReset().mockReturnValue(true)
  mockResolve.mockReset()
})

describe('useRequireAlias', () => {
  it('allows immediately when enforcement is disabled', async () => {
    mockEnabled.mockReturnValue(false)
    render(<Harness />)
    await expect(api.ensureAlias()).resolves.toBe(true)
    expect(mockResolve).not.toHaveBeenCalled()
  })

  it('allows immediately for non-zklogin (localnet) mode', async () => {
    mockSigningContext.mockReturnValue({
      mode: 'localnet',
      senderAddress: OWNER,
      chain: 'sui:localnet',
    })
    render(<Harness />)
    await expect(api.ensureAlias()).resolves.toBe(true)
    expect(mockResolve).not.toHaveBeenCalled()
  })

  it('allows immediately when an alias already exists', async () => {
    mockResolve.mockResolvedValue({ satisfied: true })
    render(<Harness />)
    await expect(api.ensureAlias()).resolves.toBe(true)
    expect(mockResolve).toHaveBeenCalledWith(OWNER, 'sui:testnet')
  })

  it('throws when zklogin enforcement applies but no sender is available', async () => {
    mockSigningContext.mockReturnValue({
      mode: 'zklogin',
      senderAddress: null,
      chain: 'sui:testnet',
    })
    render(<Harness />)
    await expect(api.ensureAlias()).rejects.toThrow('No sender address')
  })

  it('opens the modal and resolves true once registration completes', async () => {
    mockResolve.mockResolvedValue({ satisfied: false })
    render(<Harness />)

    let pending = Promise.resolve(false)
    act(() => {
      pending = api.ensureAlias()
    })

    await waitFor(() => expect(setupProps).not.toBeNull())
    act(() => setupProps?.onComplete())

    await expect(pending).resolves.toBe(true)
  })

  it('opens the modal and resolves false when the user cancels', async () => {
    mockResolve.mockResolvedValue({ satisfied: false })
    render(<Harness />)

    let pending = Promise.resolve(false)
    act(() => {
      pending = api.ensureAlias()
    })

    await waitFor(() => expect(setupProps).not.toBeNull())
    act(() => setupProps?.onCancel())

    await expect(pending).resolves.toBe(false)
  })
})
