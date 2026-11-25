import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NO_SUI_FOR_GAS_WARNING } from '#/wallet/hooks/useSendToken'
import { TransferForm } from '../SendTokenScreen.parts'

const GAS_ERROR = 'No SUI for gas (required for transaction fees)'

function renderForm({
  suiForGasWarning = null,
  showFaucetTestSui = false,
  faucetUrl = null,
  validationErrors = [] as string[],
}: {
  suiForGasWarning?: string | null
  showFaucetTestSui?: boolean
  faucetUrl?: string | null
  validationErrors?: string[]
}) {
  render(
    <TransferForm
      values={{
        recipientAddress: '',
        amount: '',
        currentBalance: '1',
        tokenSymbol: 'EVE',
      }}
      status={{
        isValidRecipient: false,
        isValidAmount: false,
        validationErrors,
        canSend: false,
        isLoading: false,
        error: null,
      }}
      notices={{
        suiForGasWarning,
        gasFeeWarning:
          'This transfer will incur a network fee (gas) paid in SUI.',
        estimatedGasFee: null,
        estimatedGasFeeLoading: false,
        showFaucetTestSui,
        faucetUrl,
      }}
      actions={{
        onRecipientChange: vi.fn(),
        onAmountChange: vi.fn(),
        onSend: vi.fn(),
      }}
    />,
  )
}

describe('TransferForm with no SUI for gas', () => {
  it('shows one notice with the faucet instead of three', () => {
    renderForm({
      suiForGasWarning: NO_SUI_FOR_GAS_WARNING,
      showFaucetTestSui: true,
      faucetUrl: 'https://faucet.example',
      validationErrors: [GAS_ERROR],
    })

    expect(screen.getAllByText(NO_SUI_FOR_GAS_WARNING)).toHaveLength(1)
    expect(screen.queryByText(GAS_ERROR)).toBeNull()
    expect(screen.queryByText('Faucet test SUI')).toBeNull()
    expect(screen.getAllByText('Open Sui faucet').length).toBeGreaterThan(0)
  })

  it('uses the same notice when sending SUI itself', () => {
    renderForm({
      showFaucetTestSui: true,
      validationErrors: [GAS_ERROR],
    })

    expect(screen.getByText(NO_SUI_FOR_GAS_WARNING)).toBeInTheDocument()
    expect(screen.queryByText(GAS_ERROR)).toBeNull()
  })

  it('leaves out the faucet where the network has none', () => {
    renderForm({
      suiForGasWarning: NO_SUI_FOR_GAS_WARNING,
      showFaucetTestSui: true,
      validationErrors: [GAS_ERROR],
    })

    expect(screen.getByText(NO_SUI_FOR_GAS_WARNING)).toBeInTheDocument()
    expect(screen.queryByText('Open Sui faucet')).toBeNull()
  })

  it('still lists the gas error while the SUI balance is unknown', () => {
    renderForm({ validationErrors: [GAS_ERROR] })

    expect(screen.queryByText(NO_SUI_FOR_GAS_WARNING)).toBeNull()
    expect(screen.getByText(GAS_ERROR)).toBeInTheDocument()
  })
})
