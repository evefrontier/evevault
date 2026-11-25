import { SUI_DEVNET_CHAIN, SUI_TESTNET_CHAIN } from '@mysten/wallet-standard'
import { fireEvent, render, screen } from '@testing-library/react'
import type { User } from 'oidc-client-ts'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('#/components/Layout', () => ({
  SubpageHeader: ({ title }: { title: string }) => <h2>{title}</h2>,
}))

import { useContextStore } from '#/stores/contextStore'
import { DEFAULT_EXPLORER } from '#/utils/explorer'
import { SettingsScreen } from '../SettingsScreen'

const user = {
  profile: { email: 'pilot@example.com', sui_address: '0x1' },
} as unknown as User

function renderSettings(
  props: Partial<Parameters<typeof SettingsScreen>[0]> = {},
) {
  return render(<SettingsScreen user={user} onBack={vi.fn()} {...props} />)
}

beforeEach(() => {
  useContextStore.setState({
    chain: SUI_TESTNET_CHAIN,
    devMode: false,
    explorer: DEFAULT_EXPLORER,
  })
})

describe('SettingsScreen', () => {
  it('starts on Suiscan and saves a new explorer choice', () => {
    renderSettings()

    expect(screen.getByRole('radio', { name: /suiscan/i })).toBeChecked()
    fireEvent.click(screen.getByRole('radio', { name: /suivision/i }))

    expect(useContextStore.getState().explorer.id).toBe('suivision')
    expect(
      screen.getByText('SuiVision', { selector: 'b.text-\\(--ink\\)' }),
    ).toBeInTheDocument()
  })

  it('says links use Suiscan where the chosen explorer has no coverage', () => {
    useContextStore.setState({
      chain: SUI_DEVNET_CHAIN,
      explorer: { id: 'suivision' },
    })
    renderSettings()

    expect(
      screen.getByText('Suiscan', { selector: 'b.text-\\(--ink\\)' }),
    ).toBeInTheDocument()
  })

  it('saves a custom template and explains an invalid one', () => {
    renderSettings()

    fireEvent.click(screen.getByRole('radio', { name: /custom/i }))
    fireEvent.change(screen.getByLabelText('Transaction URL template'), {
      target: { value: 'http://explorer.example.com/tx/{digest}' },
    })

    expect(useContextStore.getState().explorer).toEqual({
      id: 'custom',
      customTemplate: 'http://explorer.example.com/tx/{digest}',
    })
    expect(screen.getByRole('alert')).toHaveTextContent(
      "Must start with https://. Links use Suiscan until it's fixed.",
    )

    fireEvent.change(screen.getByLabelText('Transaction URL template'), {
      target: { value: 'https://explorer.example.com/tx/{digest}' },
    })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(
      screen.getByText('explorer.example.com', {
        selector: 'b.text-\\(--ink\\)',
      }),
    ).toBeInTheDocument()
  })

  it('toggles dev mode and shows the Localnet link only while it is on', () => {
    const onLocalnetSettingsClick = vi.fn()
    renderSettings({ onLocalnetSettingsClick })

    expect(screen.queryByText('Localnet settings')).toBeNull()
    fireEvent.click(screen.getByRole('switch'))

    expect(useContextStore.getState().devMode).toBe(true)
    fireEvent.click(screen.getByText('Localnet settings'))
    expect(onLocalnetSettingsClick).toHaveBeenCalledTimes(1)
  })
})
