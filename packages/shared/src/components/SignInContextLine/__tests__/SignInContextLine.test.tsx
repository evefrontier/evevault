import { TenantId } from '@evefrontier/wallet-core/tenant'
import { SUI_TESTNET_CHAIN } from '@mysten/wallet-standard'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const mockContext = vi.hoisted(() => ({
  chain: 'sui:testnet',
  devMode: false,
  forceSetChain: vi.fn(),
  loading: false,
  setChain: vi.fn(async () => ({ success: true })),
}))

vi.mock('#/hooks', () => ({
  useContext: () => mockContext,
}))

vi.mock('#/utils', () => ({
  createLogger: () => ({ error: vi.fn(), info: vi.fn() }),
  isExtension: () => false,
}))

import { SignInContextLine } from '../SignInContextLine'

describe('SignInContextLine', () => {
  it('shows the server and the current network side by side', () => {
    render(
      <SignInContextLine
        tenant={{ currentTenantId: TenantId.STILLNESS, viewOnly: true }}
      />,
    )

    expect(screen.getByText('Stillness')).toBeInTheDocument()
    expect(
      screen.getByText(SUI_TESTNET_CHAIN.toUpperCase()),
    ).toBeInTheDocument()
  })

  it('keeps a read-only server static while the network stays selectable', () => {
    render(
      <SignInContextLine
        tenant={{ currentTenantId: TenantId.STILLNESS, viewOnly: true }}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Tenant' })).toBeNull()
    fireEvent.click(
      screen.getByRole('button', { name: /network sui:testnet/i }),
    )
    expect(screen.getByRole('button', { name: 'Devnet' })).toBeInTheDocument()
  })

  it('lets the user switch servers when given the available list', () => {
    const onServerChange = vi.fn()
    render(
      <SignInContextLine
        tenant={{
          currentTenantId: TenantId.STILLNESS,
          availableTenantIds: [TenantId.STILLNESS, TenantId.LIMINALITY],
          onServerChange,
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Tenant' }))
    fireEvent.click(screen.getByText('Liminality'))

    expect(onServerChange).toHaveBeenCalledWith(TenantId.LIMINALITY)
  })
})
