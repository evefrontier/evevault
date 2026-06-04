import { toSmallestUnit } from '#/utils'

type ValidationErrorParams = {
  isNetworkReady: boolean
  isAuthenticated: boolean
  isWalletUnlocked: boolean
  hasBalance: boolean
  hasGas: boolean
  recipientAddress: string
  isValidRecipient: boolean
  amount: string
  isValidAmount: boolean
}

export const isPositiveAmountWithinBalance = (
  amount: string,
  rawBalance: string,
  decimals: number,
): boolean => {
  if (!amount || amount === '0') {
    return false
  }

  try {
    const amountInSmallestUnit = toSmallestUnit(amount, decimals)
    return (
      amountInSmallestUnit > 0n && amountInSmallestUnit <= BigInt(rawBalance)
    )
  } catch {
    return false
  }
}

/** Returns all active errors, not just the first, so the UI can surface every blocking issue at once. */
export const buildValidationErrors = (
  params: ValidationErrorParams,
): string[] => {
  return [
    errorWhen(!params.isNetworkReady, 'No network selected'),
    errorWhen(!params.isAuthenticated, 'Not authenticated'),
    errorWhen(!params.isWalletUnlocked, 'Wallet not ready'),
    errorWhen(!params.hasBalance, 'Insufficient balance'),
    errorWhen(!params.hasGas, 'No SUI for gas (required for transaction fees)'),
    errorWhen(
      Boolean(params.recipientAddress && !params.isValidRecipient),
      'Invalid Sui address',
    ),
    errorWhen(
      Boolean(params.amount && !params.isValidAmount),
      'Invalid amount',
    ),
  ].filter(Boolean) as string[]
}

export const canSendToken = ({
  isNetworkReady,
  isAuthenticated,
  isWalletUnlocked,
  hasBalance,
  hasGas,
  isValidRecipient,
  isValidAmount,
}: Omit<ValidationErrorParams, 'recipientAddress' | 'amount'>): boolean => {
  return [
    isNetworkReady,
    isAuthenticated,
    isWalletUnlocked,
    hasBalance,
    hasGas,
    isValidRecipient,
    isValidAmount,
  ].every(Boolean)
}

/** Subset of `canSendToken` conditions — gas estimation uses public data so the wallet doesn't need to be unlocked yet. */
export const isFormValidForEstimate = ({
  isValidRecipient,
  isValidAmount,
  hasBalance,
  balanceLoading,
  effectiveSenderAddress,
  chain,
}: {
  isValidRecipient: boolean
  isValidAmount: boolean
  hasBalance: boolean
  balanceLoading: boolean
  effectiveSenderAddress?: string | null
  chain?: unknown
}): boolean => {
  return [
    isValidRecipient,
    isValidAmount,
    hasBalance,
    !balanceLoading,
    effectiveSenderAddress,
    chain,
  ].every(Boolean)
}

const errorWhen = (condition: boolean, message: string): string | null => {
  return condition ? message : null
}
