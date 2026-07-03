import type React from 'react'
import Button from '#/components/Button'
import { Input } from '#/components/Inputs'
import Text from '#/components/Text'
import { formatAddress } from '#/utils'

interface TransferSuccessScreenProps {
  amount: string
  recipient: string
  tokenSymbol: string
  txDigest: string
  suiscanUrl: string | null
  onCancel?: () => void
}

/** Confirmation screen shown once a transfer has a transaction digest. */
export const TransferSuccessScreen: React.FC<TransferSuccessScreenProps> = ({
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
      <div className="w-full rounded border border-(--quantum-30) bg-(--quantum-10) p-2">
        <Text variant="light" size="xsmall" color="neutral-90">
          {suiForGasWarning}
        </Text>
      </div>
    )}

    {/* Gas fee warning (all transfers) + optional estimate */}
    <div className="w-full rounded border border-(--quantum-30) bg-(--quantum-10) p-2">
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

interface TransferFormValues {
  recipientAddress: string
  amount: string
  currentBalance: string
  tokenSymbol: string
}

interface TransferFormStatus {
  isValidRecipient: boolean
  isValidAmount: boolean
  validationErrors: string[]
  canSend: boolean
  isLoading: boolean
  error: string | null
}

interface TransferFormNotices {
  suiForGasWarning: string | null
  gasFeeWarning: string
  estimatedGasFee: string | null
  estimatedGasFeeLoading: boolean
  showFaucetTestSui: boolean
  faucetUrl: string | null
}

interface TransferFormActions {
  onRecipientChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onAmountChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onSend: () => void
  onCancel?: () => void
}

export const TransferForm: React.FC<{
  values: TransferFormValues
  status: TransferFormStatus
  notices: TransferFormNotices
  actions: TransferFormActions
}> = ({ values, status, notices, actions }) => {
  const recipientError =
    values.recipientAddress && !status.isValidRecipient
      ? 'Invalid Sui address format'
      : undefined
  const amountError =
    values.amount && !status.isValidAmount
      ? 'Invalid amount or exceeds balance'
      : undefined
  const systemErrors = status.validationErrors.filter(
    (e) => !e.includes('Invalid Sui address') && !e.includes('Invalid amount'),
  )

  return (
    <div className="flex flex-col gap-10">
      {/* Header Section - gap-4 between title and description */}
      <div className="flex flex-col gap-4">
        <Text variant="light" size="large" color="neutral-90">
          Enter the recipient address and amount
        </Text>
      </div>

      {/* Form Section - gap-10 between form groups */}
      <div className="flex flex-col gap-10 items-end">
        <TransferNotices systemErrors={systemErrors} {...notices} />

        {/* Input Row + Balance - gap-4 */}
        <div className="flex flex-col gap-4 w-full items-end">
          {/* Input Row: Recipient Address + Amount - gap-6 */}
          <div className="flex gap-6 items-start w-full">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="Recipient Address"
                value={values.recipientAddress}
                errorText={recipientError}
                onChange={actions.onRecipientChange}
              />
            </div>
            <div className="w-[160px]">
              <Input
                type="text"
                placeholder="Amount"
                value={values.amount}
                errorText={amountError}
                onChange={actions.onAmountChange}
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
              {values.currentBalance} {values.tokenSymbol}
            </span>
          </Text>
        </div>

        {/* Error Display */}
        {status.error && (
          <div className="p-2 bg-red-10/10 border border-red-10/30 w-full">
            <Text variant="light" size="xsmall" color="error">
              {status.error}
            </Text>
          </div>
        )}

        {/* Action Buttons - gap-1 (DuoButton style) */}
        <div className="flex gap-1">
          <Button
            disabled={!status.canSend || status.isLoading}
            isLoading={status.isLoading}
            onClick={actions.onSend}
          >
            {status.isLoading ? 'Sending...' : 'transfer'}
          </Button>
          <Button variant="secondary" onClick={actions.onCancel}>
            cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
