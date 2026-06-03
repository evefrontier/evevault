import { isValidSuiAddress } from '@mysten/sui/utils'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { createLogger, GAS_FEE_WARNING_MESSAGE, SUI_COIN_TYPE } from '#/utils'
import { isEveCoinType } from '#/wallet/eveToken'
import { useBalance } from './useBalance'
import {
  buildValidationErrors,
  canSendToken,
  executeTokenTransfer,
  isFormValidForEstimate,
  isPositiveAmountWithinBalance,
  refetchTransferQueries,
  useDelayedTransferRefetch,
  useEstimatedGasFee,
} from './useSendToken.helpers'
import { useWalletSigningContext } from './useWalletSigningContext'

const log = createLogger()

interface UseSendTokenParams {
  coinType: string
  recipientAddress: string
  amount: string
}

interface UseSendTokenResult {
  // Validation state
  isNetworkReady: boolean
  isAuthenticated: boolean
  isWalletUnlocked: boolean
  hasBalance: boolean
  isValidRecipient: boolean
  isValidAmount: boolean
  canSend: boolean
  validationErrors: string[]

  /** Warning when sending a non-SUI token but wallet has no SUI for gas. Non-blocking. */
  suiForGasWarning: string | null

  /** True when SUI balance is zero; show faucet iframe/link for testnet. */
  showFaucetTestSui: boolean

  /** Static message: transfer incurs a network fee paid in SUI. */
  gasFeeWarning: string

  /** Estimated fee in SUI from simulation, or null if unavailable. */
  estimatedGasFee: string | null

  /** True while estimating gas (debounced simulation in progress). */
  estimatedGasFeeLoading: boolean

  // Balance info
  currentBalance: string
  tokenSymbol: string
  tokenName: string
  decimals: number

  // Execution
  send: () => Promise<void>
  isLoading: boolean
  error: string | null
  txDigest: string | null
}

/**
 * Hook for sending tokens with validation and transaction execution
 */
export function useSendToken({
  coinType,
  recipientAddress,
  amount,
}: UseSendTokenParams): UseSendTokenResult {
  const {
    chain,
    localnetUrl,
    isAuthenticated,
    isWalletUnlocked,
    senderAddress: effectiveSenderAddress,
    localnetAddress,
    user,
    suiClient,
    getSenderAddress,
    sign,
  } = useWalletSigningContext()
  const queryClient = useQueryClient()

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txDigest, setTxDigest] = useState<string | null>(null)
  const scheduleDelayedTransferRefetch = useDelayedTransferRefetch(queryClient)

  // Fetch balance for the selected token
  const { data: balanceData, isLoading: balanceLoading } = useBalance({
    user,
    chain,
    coinType,
    address: localnetAddress ?? undefined,
    localnetUrl,
  })

  // Fetch SUI balance for gas warning and send eligibility (non-SUI transfers need SUI for gas)
  const { data: suiBalanceData, isLoading: suiBalanceLoading } = useBalance({
    user,
    chain,
    coinType: SUI_COIN_TYPE,
    address: localnetAddress ?? undefined,
    localnetUrl,
  })

  // Extract balance info
  const currentBalance = balanceData?.formattedBalance ?? '0'
  const rawBalance = balanceData?.rawBalance ?? '0'
  const tokenSymbol =
    balanceData?.metadata?.symbol ?? (isEveCoinType(coinType) ? 'EVE' : '')
  const tokenName =
    balanceData?.metadata?.name ??
    (isEveCoinType(coinType) ? 'EVE test token' : 'Token')
  const decimals = balanceData?.metadata?.decimals ?? 9

  // Validation checks
  const isNetworkReady = !!chain
  const hasBalance = !balanceLoading && BigInt(rawBalance) > 0n
  const isValidRecipient =
    recipientAddress.length > 0 && isValidSuiAddress(recipientAddress)

  // Amount validation
  const isValidAmount = useMemo(() => {
    return isPositiveAmountWithinBalance(amount, rawBalance, decimals)
  }, [amount, rawBalance, decimals])

  const rawSuiBalance = suiBalanceData?.rawBalance ?? '0'
  const hasZeroSui = !suiBalanceLoading && BigInt(rawSuiBalance) === 0n
  const hasGas =
    coinType === SUI_COIN_TYPE || (suiBalanceLoading ? false : !hasZeroSui)

  // Collect validation errors
  const validationErrors = useMemo(() => {
    return buildValidationErrors({
      isNetworkReady,
      isAuthenticated,
      isWalletUnlocked,
      hasBalance,
      hasGas,
      recipientAddress,
      isValidRecipient,
      amount,
      isValidAmount,
    })
  }, [
    isNetworkReady,
    isAuthenticated,
    isWalletUnlocked,
    hasBalance,
    hasGas,
    isValidRecipient,
    isValidAmount,
    recipientAddress,
    amount,
  ])

  const canSend = canSendToken({
    isNetworkReady,
    isAuthenticated,
    isWalletUnlocked,
    hasBalance,
    hasGas,
    isValidRecipient,
    isValidAmount,
  })

  const suiForGasWarning =
    !suiBalanceLoading && coinType !== SUI_COIN_TYPE && hasZeroSui
      ? 'You have no SUI balance. SUI is required to pay for transaction fees.'
      : null
  const showFaucetTestSui = !suiBalanceLoading && hasZeroSui

  const formValidForEstimate = isFormValidForEstimate({
    isValidRecipient,
    isValidAmount,
    hasBalance,
    balanceLoading,
    effectiveSenderAddress,
    chain,
  })

  const { estimatedGasFee, estimatedGasFeeLoading } = useEstimatedGasFee({
    formValidForEstimate,
    suiClient,
    getSenderAddress,
    amount,
    decimals,
    recipientAddress,
    coinType,
  })

  const send = useCallback(async () => {
    if (!canSend) {
      setError('Cannot send: validation failed')
      return
    }

    setIsLoading(true)
    setError(null)
    setTxDigest(null)

    try {
      const digest = await executeTokenTransfer({
        amount,
        coinType,
        decimals,
        recipientAddress,
        suiClient,
        getSenderAddress,
        sign,
      })

      log.info('Token transfer executed', {
        digest,
        coinType,
        amount,
        recipient: recipientAddress,
      })

      setTxDigest(digest)
      refetchTransferQueries(queryClient)
      scheduleDelayedTransferRefetch()
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to send token'
      log.error('Token transfer failed', err)
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [
    canSend,
    coinType,
    amount,
    decimals,
    recipientAddress,
    getSenderAddress,
    sign,
    suiClient,
    queryClient,
    scheduleDelayedTransferRefetch,
  ])

  return {
    // Validation state
    isNetworkReady,
    isAuthenticated,
    isWalletUnlocked,
    hasBalance,
    isValidRecipient,
    isValidAmount,
    canSend,
    validationErrors,
    suiForGasWarning,
    showFaucetTestSui,
    gasFeeWarning: GAS_FEE_WARNING_MESSAGE,
    estimatedGasFee,
    estimatedGasFeeLoading,

    // Balance info
    currentBalance,
    tokenSymbol,
    tokenName,
    decimals,

    // Execution
    send,
    isLoading,
    error,
    txDigest,
  }
}
