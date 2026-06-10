import type React from 'react'
import { useEffect, useState } from 'react'
import Button from '#/components/Button'
import Heading from '#/components/Heading'
import { Input } from '#/components/Inputs'
import Text from '#/components/Text'
import { useToast } from '#/components/Toast'
import { useContext } from '#/hooks/useContext'
import { useDeviceStore } from '#/stores/deviceStore'
import { getFaucetUrlForChain } from '#/sui'
import type { SendTokenScreenProps } from '#/types'
import { formatAddress, getSuiscanUrl } from '#/utils'
import { useSendToken } from '#/wallet'

interface TransferSuccessScreenProps {
  amount: string
  recipient: string
  tokenSymbol: string
  txDigest: string
  suiscanUrl: string | null
  onCancel: () => void
}

/** Confirmation screen shown once a transfer has a transaction digest. */
const TransferSuccessScreen: React.FC<TransferSuccessScreenProps> = ({
  amount,
  recipient,
  tokenSymbol,
  txDigest,
  suiscanUrl,
  onCancel,
}) => (
  <div className="flex flex-col gap-20">
    {/* Header + Transaction Details */}
    <div className="flex flex-col gap-6">
      {/* Title */}
      <Heading level={2}>Transfer completed</Heading>

      {/* Transaction Details */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <Text variant="bold" size="small" color="neutral-90">
            Amount sent
          </Text>
          <Text variant="light" size="small" color="neutral-90">
            {amount} {tokenSymbol}
          </Text>
        </div>

        <div className="flex justify-between items-center">
          <Text variant="bold" size="small" color="neutral-90">
            Recipient address
          </Text>
          <Text variant="light" size="small" color="neutral-90">
            {formatAddress(recipient, 8, 8)}
          </Text>
        </div>

        <div className="flex justify-between items-center">
          <Text variant="bold" size="small" color="neutral-90">
            Transaction
          </Text>
          <Text variant="light" size="small" color="neutral-90">
            {formatAddress(txDigest, 8, 8)}
          </Text>
        </div>
      </div>
    </div>

    {/* Buttons - Centered */}
    <div className="flex justify-center gap-1">
      <Button onClick={onCancel}>close</Button>
      {suiscanUrl && (
        <Button
          variant="secondary"
          onClick={() =>
            window.open(suiscanUrl, '_blank', 'noopener,noreferrer')
          }
        >
          View on Suiscan
        </Button>
      )}
    </div>
  </div>
)

interface TransferNoticesProps {
  systemErrors: string[]
  suiForGasWarning?: string | null
  gasFeeWarning?: string | null
  estimatedGasFee?: string | null
  estimatedGasFeeLoading: boolean
  showFaucetTestSui: boolean
  faucetUrl: string | null
}

/** Validation errors, gas warnings/estimate and the faucet shortcut. */
const TransferNotices: React.FC<TransferNoticesProps> = ({
  systemErrors,
  suiForGasWarning,
  gasFeeWarning,
  estimatedGasFee,
  estimatedGasFeeLoading,
  showFaucetTestSui,
  faucetUrl,
}) => (
  <>
    {/* System Validation Errors */}
    {systemErrors.length > 0 && (
      <div className="p-2 bg-red-10/10 border border-red-10/30 w-full">
        {systemErrors.map((err) => (
          <Text key={err} variant="light" size="xsmall" color="error">
            {err}
          </Text>
        ))}
      </div>
    )}

    {/* SUI for gas warning (non-blocking) */}
    {suiForGasWarning && (
      <div className="w-full rounded border border-[var(--quantum-30)] bg-[var(--quantum-10)] p-2">
        <Text variant="light" size="xsmall" color="neutral-90">
          {suiForGasWarning}
        </Text>
      </div>
    )}

    {/* Gas fee warning (all transfers) + optional estimate */}
    <div className="w-full rounded border border-[var(--quantum-30)] bg-[var(--quantum-10)] p-2">
      <Text variant="light" size="xsmall" color="neutral-90">
        {gasFeeWarning}
      </Text>
      {estimatedGasFeeLoading && (
        <Text
          variant="light"
          size="xsmall"
          color="neutral-90"
          className="mt-1 block"
        >
          Estimating fee…
        </Text>
      )}
      {!estimatedGasFeeLoading && estimatedGasFee && (
        <Text
          variant="light"
          size="xsmall"
          color="neutral-90"
          className="mt-1 block"
        >
          Estimated fee: ~{estimatedGasFee} SUI
        </Text>
      )}
    </div>

    {/* Faucet when 0 SUI balance – only show when current network has a faucet (e.g. devnet/testnet) */}
    {showFaucetTestSui && faucetUrl && (
      <div className="flex w-full flex-col gap-2">
        <Text variant="light" size="small" color="neutral-90">
          Faucet test SUI
        </Text>
        <Button
          variant="secondary"
          size="medium"
          onClick={() =>
            window.open(faucetUrl, '_blank', 'noopener,noreferrer')
          }
        >
          Open Sui faucet
        </Button>
      </div>
    )}
  </>
)

interface TransferFormProps {
  recipientAddress: string
  amount: string
  isValidRecipient: boolean
  isValidAmount: boolean
  validationErrors: string[]
  currentBalance: string
  tokenSymbol: string
  canSend: boolean
  isLoading: boolean
  error: string | null
  suiForGasWarning: string | null
  gasFeeWarning: string
  estimatedGasFee: string | null
  estimatedGasFeeLoading: boolean
  showFaucetTestSui: boolean
  faucetUrl: string | null
  onRecipientChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onAmountChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onSend: () => void
  onCancel: () => void
}

/** Transfer entry form: notices, recipient/amount inputs and action buttons. */
const TransferForm: React.FC<TransferFormProps> = ({
  recipientAddress,
  amount,
  isValidRecipient,
  isValidAmount,
  validationErrors,
  currentBalance,
  tokenSymbol,
  canSend,
  isLoading,
  error,
  suiForGasWarning,
  gasFeeWarning,
  estimatedGasFee,
  estimatedGasFeeLoading,
  showFaucetTestSui,
  faucetUrl,
  onRecipientChange,
  onAmountChange,
  onSend,
  onCancel,
}) => {
  // Derive input errors for display
  const recipientError =
    recipientAddress && !isValidRecipient
      ? 'Invalid Sui address format'
      : undefined
  const amountError =
    amount && !isValidAmount ? 'Invalid amount or exceeds balance' : undefined

  // Filter validation errors for display (exclude input-specific ones)
  const systemErrors = validationErrors.filter(
    (e) => !e.includes('Invalid Sui address') && !e.includes('Invalid amount'),
  )

  return (
    <div className="flex flex-col gap-10">
      {/* Header Section - gap-4 between title and description */}
      <div className="flex flex-col gap-4">
        <Heading level={2}>Transfer token</Heading>
        <Text variant="light" size="large" color="neutral-90">
          Enter the recipient address and amount
        </Text>
      </div>

      {/* Form Section - gap-10 between form groups */}
      <div className="flex flex-col gap-10 items-end">
        <TransferNotices
          systemErrors={systemErrors}
          suiForGasWarning={suiForGasWarning}
          gasFeeWarning={gasFeeWarning}
          estimatedGasFee={estimatedGasFee}
          estimatedGasFeeLoading={estimatedGasFeeLoading}
          showFaucetTestSui={showFaucetTestSui}
          faucetUrl={faucetUrl}
        />

        {/* Input Row + Balance - gap-4 */}
        <div className="flex flex-col gap-4 w-full items-end">
          {/* Input Row: Recipient Address + Amount - gap-6 */}
          <div className="flex gap-6 items-start w-full">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="Recipient Address"
                value={recipientAddress}
                errorText={recipientError}
                onChange={onRecipientChange}
              />
            </div>
            <div className="w-[160px]">
              <Input
                type="text"
                placeholder="Amount"
                value={amount}
                errorText={amountError}
                onChange={onAmountChange}
              />
            </div>
          </div>

          {/* Wallet Balance - Right aligned */}
          <Text
            variant="light"
            size="small"
            color="neutral-90"
            className="whitespace-nowrap"
          >
            Wallet balance:{' '}
            <span className="font-medium">
              {currentBalance} {tokenSymbol}
            </span>
          </Text>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-2 bg-red-10/10 border border-red-10/30 w-full">
            <Text variant="light" size="xsmall" color="error">
              {error}
            </Text>
          </div>
        )}

        {/* Action Buttons - gap-1 (DuoButton style) */}
        <div className="flex gap-1">
          <Button
            disabled={!canSend || isLoading}
            isLoading={isLoading}
            onClick={onSend}
          >
            {isLoading ? 'Sending...' : 'transfer'}
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            cancel
          </Button>
        </div>
      </div>
    </div>
  )
}

export const SendTokenScreen: React.FC<SendTokenScreenProps> = ({
  coinType,
  onCancel,
}) => {
  const { showToast } = useToast()
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
    <TransferForm
      recipientAddress={recipientAddress}
      amount={amount}
      isValidRecipient={isValidRecipient}
      isValidAmount={isValidAmount}
      validationErrors={validationErrors}
      currentBalance={currentBalance}
      tokenSymbol={tokenSymbol}
      canSend={canSend}
      isLoading={isLoading}
      error={error}
      suiForGasWarning={suiForGasWarning}
      gasFeeWarning={gasFeeWarning}
      estimatedGasFee={estimatedGasFee}
      estimatedGasFeeLoading={estimatedGasFeeLoading}
      showFaucetTestSui={showFaucetTestSui}
      faucetUrl={faucetUrl}
      onRecipientChange={handleRecipientChange}
      onAmountChange={handleAmountChange}
      onSend={handleSend}
      onCancel={onCancel}
    />
  )
}
