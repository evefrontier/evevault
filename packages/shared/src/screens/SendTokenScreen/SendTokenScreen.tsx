import type React from 'react'
import { useEffect, useState } from 'react'
import { useToast } from '#/components/Toast'
import { useContext } from '#/hooks/useContext'
import { useDeviceStore } from '#/stores/deviceStore'
import { getFaucetUrlForChain } from '#/sui'
import type { SendTokenScreenProps } from '#/types'
import { getSuiscanUrl } from '#/utils'
import { useSendToken } from '#/wallet'
import { useRequireAlias } from '../AliasRecoverySetupScreen/useRequireAlias'
import { TransferForm, TransferSuccessScreen } from './SendTokenScreen.parts'

export const SendTokenScreen: React.FC<SendTokenScreenProps> = ({
  coinType,
  onCancel,
}) => {
  const { showToast } = useToast()
  const { ensureAlias, aliasSetupModal } = useRequireAlias()
  const { chain: currentChain } = useContext()
  const {
    localnet: { url: localnetUrl },
  } = useDeviceStore()
  const [recipientAddress, setRecipientAddress] = useState('')
  const [amount, setAmount] = useState('')
  // Store the submitted values to show on success screen
  const [submittedRecipient, setSubmittedRecipient] = useState('')
  const [submittedAmount, setSubmittedAmount] = useState('')

  const {
    currentBalance,
    tokenSymbol,
    canSend,
    validationErrors,
    suiForGasWarning,
    showFaucetTestSui,
    gasFeeWarning,
    estimatedGasFee,
    estimatedGasFeeLoading,
    isLoading,
    error,
    txDigest,
    send,
    isValidRecipient,
    isValidAmount,
  } = useSendToken({
    coinType,
    recipientAddress,
    amount,
  })

  const faucetUrl = getFaucetUrlForChain(currentChain)

  const handleRecipientChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setRecipientAddress(event.target.value.trim())
  }

  const handleAmountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    // Allow only valid number input
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value)
    }
  }

  const handleSend = async () => {
    if (!(await ensureAlias())) return
    // Store the values before sending so we can show them on success screen
    setSubmittedRecipient(recipientAddress)
    setSubmittedAmount(amount)
    await send()
    // Don't call onSuccess here - let the success screen show first
  }

  // Show toast when error occurs
  useEffect(() => {
    if (error) {
      showToast('Transaction failed')
    }
  }, [error, showToast])

  // Show toast when transaction succeeds
  useEffect(() => {
    if (txDigest) {
      showToast('Transaction confirmed!')
    }
  }, [txDigest, showToast])

  // Show success/confirmation screen
  if (txDigest) {
    const suiscanUrl = currentChain
      ? getSuiscanUrl(currentChain, txDigest, {
          localnetUrl: localnetUrl ?? undefined,
        })
      : null

    return (
      <TransferSuccessScreen
        amount={submittedAmount}
        recipient={submittedRecipient}
        tokenSymbol={tokenSymbol}
        txDigest={txDigest}
        suiscanUrl={suiscanUrl}
        onCancel={onCancel}
      />
    )
  }

  return (
    <>
      <TransferForm
        values={{
          recipientAddress,
          amount,
          currentBalance,
          tokenSymbol,
        }}
        status={{
          isValidRecipient,
          isValidAmount,
          validationErrors,
          canSend,
          isLoading,
          error,
        }}
        notices={{
          suiForGasWarning,
          gasFeeWarning,
          estimatedGasFee,
          estimatedGasFeeLoading,
          showFaucetTestSui,
          faucetUrl,
        }}
        actions={{
          onRecipientChange: handleRecipientChange,
          onAmountChange: handleAmountChange,
          onSend: handleSend,
          onCancel,
        }}
      />
      {aliasSetupModal}
    </>
  )
}
