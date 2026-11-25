import type React from 'react'
import Button from '#/components/Button'
import { Input } from '#/components/Inputs'
import Text from '#/components/Text'
import { formatAddress } from '#/utils'
import { NO_SUI_FOR_GAS_WARNING } from '#/wallet/hooks/useSendToken'

interface TransferSuccessScreenProps {
  amount: string
  recipient: string
  tokenSymbol: string
  txDigest: string
  explorerUrl: string | null
  explorerName: string
  onCancel?: () => void
}

/** Confirmation screen shown once a transfer has a transaction digest. */
export const TransferSuccessScreen: React.FC<TransferSuccessScreenProps> = ({
  amount,
  recipient,
  tokenSymbol,
  txDigest,
  explorerUrl,
  explorerName,
  onCancel,
}) => (
  <div className="flex flex-col gap-6">
    <div className="c-card c-card--on">
      <dl className="c-kv">
        <dt>Amount sent</dt>
        <dd>
          {amount} {tokenSymbol}
        </dd>
        <dt>Recipient address</dt>
        <dd>{formatAddress(recipient, 8, 8)}</dd>
        <dt>Transaction</dt>
        <dd>{formatAddress(txDigest, 8, 8)}</dd>
      </dl>
    </div>

    {/* Buttons - Centered */}
    <div className="flex justify-center gap-3">
      <Button onClick={onCancel}>close</Button>
      {explorerUrl && (
        <Button
          variant="secondary"
          onClick={() =>
            window.open(explorerUrl, '_blank', 'noopener,noreferrer')
          }
        >
          View on {explorerName}
        </Button>
      )}
    </div>
  </div>
)

interface TransferNoticesProps {
  systemErrors: string[]
  noSuiWarning: string | null
  gasFeeWarning?: string | null
  estimatedGasFee?: string | null
  estimatedGasFeeLoading: boolean
  faucetUrl: string | null
}

/** Validation errors, the no-SUI notice with its faucet, and the gas estimate. */
const TransferNotices: React.FC<TransferNoticesProps> = ({
  systemErrors,
  noSuiWarning,
  gasFeeWarning,
  estimatedGasFee,
  estimatedGasFeeLoading,
  faucetUrl,
}) => (
  <>
    {/* System Validation Errors */}
    {systemErrors.length > 0 && (
      <div className="c-banner c-banner--red">
        {systemErrors.map((err) => (
          <Text key={err} variant="light" size="xsmall" color="error">
            {err}
          </Text>
        ))}
      </div>
    )}

    {/* No SUI for gas: one notice, with the faucet where the network has one */}
    {noSuiWarning && (
      <div className="c-banner c-banner--amber flex-row! items-center gap-3">
        <Text
          variant="light"
          size="xsmall"
          color="neutral-90"
          className="flex-1"
        >
          {noSuiWarning}
        </Text>
        {faucetUrl && (
          <Button
            variant="secondary"
            size="small"
            onClick={() =>
              window.open(faucetUrl, '_blank', 'noopener,noreferrer')
            }
          >
            Open Sui faucet
          </Button>
        )}
      </div>
    )}

    {/* Gas fee warning (all transfers) + optional estimate */}
    <div className="c-banner">
      <Text variant="light" size="xsmall" color="neutral-90">
        {gasFeeWarning}
      </Text>
      {estimatedGasFeeLoading && (
        <Text
          variant="light"
          size="xsmall"
          color="neutral-90"
          className="block"
        >
          Estimating fee…
        </Text>
      )}
      {!estimatedGasFeeLoading && estimatedGasFee && (
        <Text
          variant="light"
          size="xsmall"
          color="neutral-90"
          className="block"
        >
          Estimated fee: ~{estimatedGasFee} SUI
        </Text>
      )}
    </div>
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
  const { suiForGasWarning, showFaucetTestSui, ...gasNotices } = notices
  // Zero SUI (when sending SUI too) gets one notice; its validation error is
  // folded into it rather than listed again.
  const noSuiWarning =
    suiForGasWarning ?? (showFaucetTestSui ? NO_SUI_FOR_GAS_WARNING : null)
  const systemErrors = status.validationErrors.filter(
    (e) =>
      !e.includes('Invalid Sui address') &&
      !e.includes('Invalid amount') &&
      !(noSuiWarning && e.includes('No SUI for gas')),
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4">
        <Text variant="light" size="medium" color="n60">
          Enter the recipient address and amount
        </Text>
      </div>

      <div className="flex flex-col gap-4 items-end">
        <TransferNotices
          systemErrors={systemErrors}
          noSuiWarning={noSuiWarning}
          {...gasNotices}
        />

        <div className="flex flex-col gap-2 w-full items-end">
          <div className="flex gap-3 items-start w-full">
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
            color="n60"
            className="whitespace-nowrap"
          >
            Wallet balance:{' '}
            <span className="text-(--ink) tabular-nums">
              {values.currentBalance} {values.tokenSymbol}
            </span>
          </Text>
        </div>

        {/* Error Display */}
        {status.error && (
          <div className="c-banner c-banner--red">
            <Text variant="light" size="xsmall" color="error">
              {status.error}
            </Text>
          </div>
        )}

        <div className="flex gap-3">
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
