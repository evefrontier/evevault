import { getEveCoinType } from '@evefrontier/wallet-core/eve-token'
import { TenantId } from '@evefrontier/wallet-core/tenant'
import {
  SUI_DEVNET_CHAIN,
  SUI_TESTNET_CHAIN,
  type SuiChain,
} from '@mysten/wallet-standard'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TokenRow } from '../TokenRow'

vi.mock('#/wallet', () => ({
  useBalance: () => ({ data: undefined, isLoading: false }),
}))

const EVE = getEveCoinType(TenantId.STILLNESS)

const renderRow = (
  coinType: string,
  chain: SuiChain = SUI_TESTNET_CHAIN,
  onCopyAddress = vi.fn(),
) =>
  render(
    <TokenRow
      coinType={coinType}
      user={null}
      chain={chain}
      isSelected={false}
      onSelect={vi.fn()}
      onCopyAddress={onCopyAddress}
    />,
  )

describe('TokenRow address', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows the MVR package name for a cached coin type', () => {
    renderRow(EVE)

    expect(screen.getByText('@evefrontier/currency')).toBeInTheDocument()
  })

  it('copies the raw coin type, not the MVR name', () => {
    const onCopyAddress = vi.fn()
    renderRow(EVE, SUI_TESTNET_CHAIN, onCopyAddress)

    fireEvent.click(screen.getByRole('button', { name: 'Copy coin type' }))

    expect(onCopyAddress).toHaveBeenCalledWith(EVE)
  })

  it('exposes the full coin type on hover for MVR-named types', () => {
    renderRow(EVE)

    expect(screen.getByText('@evefrontier/currency')).toHaveAttribute(
      'title',
      EVE,
    )
    expect(
      screen.getByRole('button', { name: 'Copy coin type' }),
    ).toHaveAttribute('title', `Copy ${EVE}`)
  })

  it('truncates coin types without an MVR name', () => {
    renderRow('0x2::sui::SUI')

    expect(screen.getByText('0x2::s•••:SUI')).toBeInTheDocument()
  })

  it('truncates on networks without an MVR cache', () => {
    renderRow(EVE, SUI_DEVNET_CHAIN)

    expect(
      screen.getByText(`${EVE.slice(0, 6)}•••${EVE.slice(-4)}`),
    ).toBeInTheDocument()
  })
})
