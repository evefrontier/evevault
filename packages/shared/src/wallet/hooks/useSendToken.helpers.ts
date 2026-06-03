import type { SuiGrpcClient } from '@mysten/sui/grpc'
import { Transaction } from '@mysten/sui/transactions'
import type { QueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import {
  createLogger,
  formatMistToSui,
  SUI_COIN_TYPE,
  toSmallestUnit,
} from '#/utils'

const log = createLogger()
const BALANCE_REFETCH_DELAY_MS = 2000
const ESTIMATE_DEBOUNCE_MS = 600

type CoinWithBalance = { balance: string; objectId: string }

type GasEstimateParams = {
  formValidForEstimate: boolean
  suiClient: SuiGrpcClient
  getSenderAddress: () => Promise<string | null>
  amount: string
  decimals: number
  recipientAddress: string
  coinType: string
}

type ExecuteTransferParams = {
  amount: string
  coinType: string
  decimals: number
  recipientAddress: string
  suiClient: SuiGrpcClient
  getSenderAddress: () => Promise<string | null>
  sign: (
    scope: 'TransactionData',
    bytes: Uint8Array,
  ) => Promise<{ bytes: string; signature: string }>
}

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

type SimulateResult =
  | {
      $kind: 'Transaction'
      Transaction: { effects?: { gasUsed?: GasUsedShape } }
    }
  | {
      $kind: 'FailedTransaction'
      FailedTransaction: { effects?: { gasUsed?: GasUsedShape } }
    }

type GasUsedShape = {
  computationCost?: string
  storageCost?: string
  storageRebate?: string
  nonRefundableStorageFee?: string
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

export const buildValidationErrors = ({
  isNetworkReady,
  isAuthenticated,
  isWalletUnlocked,
  hasBalance,
  hasGas,
  recipientAddress,
  isValidRecipient,
  amount,
  isValidAmount,
}: ValidationErrorParams): string[] => {
  const errors: string[] = []
  if (!isNetworkReady) errors.push('No network selected')
  if (!isAuthenticated) errors.push('Not authenticated')
  if (!isWalletUnlocked) errors.push('Wallet not ready')
  if (!hasBalance) errors.push('Insufficient balance')
  if (!hasGas) errors.push('No SUI for gas (required for transaction fees)')
  if (recipientAddress && !isValidRecipient) errors.push('Invalid Sui address')
  if (amount && !isValidAmount) errors.push('Invalid amount')
  return errors
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

export async function buildTransferTransactionBytes(
  senderAddress: string,
  recipientAddress: string,
  amountInSmallestUnit: bigint,
  coinType: string,
  suiClient: SuiGrpcClient,
): Promise<Uint8Array> {
  const tx = new Transaction()
  tx.setSender(senderAddress)

  if (coinType === SUI_COIN_TYPE) {
    const [coin] = tx.splitCoins(tx.gas, [amountInSmallestUnit])
    tx.transferObjects([coin], recipientAddress)
  } else {
    await addTokenTransfer(tx, {
      senderAddress,
      recipientAddress,
      amountInSmallestUnit,
      coinType,
      suiClient,
    })
  }

  const txb = await tx.build({ client: suiClient })
  return new Uint8Array(txb)
}

const addTokenTransfer = async (
  tx: Transaction,
  {
    senderAddress,
    recipientAddress,
    amountInSmallestUnit,
    coinType,
    suiClient,
  }: {
    senderAddress: string
    recipientAddress: string
    amountInSmallestUnit: bigint
    coinType: string
    suiClient: SuiGrpcClient
  },
) => {
  const { objects: coinObjects } = await suiClient.listCoins({
    owner: senderAddress,
    coinType,
  })
  const primaryCoin = getPrimaryCoinForTransfer(
    coinObjects,
    amountInSmallestUnit,
  )
  const suitableCoin = coinObjects.find(
    (coin: CoinWithBalance) => BigInt(coin.balance) >= amountInSmallestUnit,
  )

  if (!suitableCoin) {
    const otherCoins = coinObjects.slice(1)
    if (otherCoins.length > 0) {
      tx.mergeCoins(
        tx.object(primaryCoin.objectId),
        otherCoins.map((coin: CoinWithBalance) => tx.object(coin.objectId)),
      )
    }
  }

  const coinObjectId = suitableCoin?.objectId ?? primaryCoin.objectId
  const [coin] = tx.splitCoins(tx.object(coinObjectId), [amountInSmallestUnit])
  tx.transferObjects([coin], recipientAddress)
}

const getPrimaryCoinForTransfer = (
  coinObjects: CoinWithBalance[],
  amountInSmallestUnit: bigint,
): CoinWithBalance => {
  if (coinObjects.length === 0) {
    throw new Error('No coins found for this token')
  }

  const totalBalance = coinObjects.reduce(
    (sum: bigint, coin: CoinWithBalance) => sum + BigInt(coin.balance),
    0n,
  )
  if (totalBalance < amountInSmallestUnit) {
    throw new Error('Token balance changed during transaction preparation')
  }

  return coinObjects[0]
}

export function parseGasUsedFromSimulation(result: unknown): string | null {
  try {
    const gasUsed = getSimulationGasUsed(result)
    if (!gasUsed) return null

    const computation = BigInt(gasUsed.computationCost ?? '0')
    const storage = BigInt(gasUsed.storageCost ?? '0')
    const rebate = BigInt(gasUsed.storageRebate ?? '0')
    const nonRefundable = BigInt(gasUsed.nonRefundableStorageFee ?? '0')
    const total = computation + storage - rebate + nonRefundable
    return total > 0n ? total.toString() : null
  } catch {
    return null
  }
}

const getSimulationGasUsed = (result: unknown): GasUsedShape | undefined => {
  const r = result as SimulateResult
  if (r?.$kind === 'Transaction') {
    return r.Transaction?.effects?.gasUsed
  }
  if (r?.$kind === 'FailedTransaction') {
    return r.FailedTransaction?.effects?.gasUsed
  }
  return undefined
}

export const useEstimatedGasFee = ({
  formValidForEstimate,
  suiClient,
  getSenderAddress,
  amount,
  decimals,
  recipientAddress,
  coinType,
}: GasEstimateParams) => {
  const [estimatedGasFee, setEstimatedGasFee] = useState<string | null>(null)
  const [estimatedGasFeeLoading, setEstimatedGasFeeLoading] = useState(false)
  const estimateRunIdRef = useRef(0)

  useEffect(() => {
    if (!formValidForEstimate || !suiClient) {
      setEstimatedGasFee(null)
      setEstimatedGasFeeLoading(false)
      return
    }

    const runId = ++estimateRunIdRef.current
    const timer = setTimeout(() => {
      void estimateGasFee({
        runId,
        estimateRunIdRef,
        setEstimatedGasFee,
        setEstimatedGasFeeLoading,
        getSenderAddress,
        amount,
        decimals,
        recipientAddress,
        coinType,
        suiClient,
      })
    }, ESTIMATE_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [
    formValidForEstimate,
    suiClient,
    getSenderAddress,
    amount,
    decimals,
    recipientAddress,
    coinType,
  ])

  return { estimatedGasFee, estimatedGasFeeLoading }
}

type EstimateGasFeeTaskParams = Omit<
  GasEstimateParams,
  'formValidForEstimate'
> & {
  runId: number
  estimateRunIdRef: { current: number }
  setEstimatedGasFee: (value: string | null) => void
  setEstimatedGasFeeLoading: (value: boolean) => void
}

const estimateGasFee = async ({
  runId,
  estimateRunIdRef,
  setEstimatedGasFee,
  setEstimatedGasFeeLoading,
  getSenderAddress,
  amount,
  decimals,
  recipientAddress,
  coinType,
  suiClient,
}: EstimateGasFeeTaskParams) => {
  setEstimatedGasFeeLoading(true)
  setEstimatedGasFee(null)

  try {
    const mist = await estimateGasMist({
      formValidForEstimate: true,
      suiClient,
      getSenderAddress,
      amount,
      decimals,
      recipientAddress,
      coinType,
    })
    if (runId === estimateRunIdRef.current && mist) {
      setEstimatedGasFee(formatMistToSui(mist))
    }
  } catch (err) {
    log.warn('Gas estimation failed', { err })
    if (runId === estimateRunIdRef.current) {
      setEstimatedGasFee(null)
    }
  } finally {
    if (runId === estimateRunIdRef.current) {
      setEstimatedGasFeeLoading(false)
    }
  }
}

const estimateGasMist = async ({
  suiClient,
  getSenderAddress,
  amount,
  decimals,
  recipientAddress,
  coinType,
}: GasEstimateParams): Promise<string | null> => {
  const senderAddress = await getSenderAddress()
  if (!senderAddress) {
    return null
  }

  const amountInSmallestUnit = toSmallestUnit(amount, decimals)
  const txBytes = await buildTransferTransactionBytes(
    senderAddress,
    recipientAddress,
    amountInSmallestUnit,
    coinType,
    suiClient,
  )
  const sim = await suiClient.simulateTransaction({
    transaction: txBytes,
    include: { effects: true },
  })
  return parseGasUsedFromSimulation(sim)
}

export const executeTokenTransfer = async ({
  amount,
  coinType,
  decimals,
  recipientAddress,
  suiClient,
  getSenderAddress,
  sign,
}: ExecuteTransferParams): Promise<string | null> => {
  const senderAddress = await getSenderAddress()
  if (!senderAddress) {
    throw new Error('Wallet not ready to sign')
  }

  const amountInSmallestUnit = toSmallestUnit(amount, decimals)
  const txBytes = await buildTransferTransactionBytes(
    senderAddress,
    recipientAddress,
    amountInSmallestUnit,
    coinType,
    suiClient,
  )
  const { bytes, signature } = await sign('TransactionData', txBytes)

  log.debug('Transaction signed', {
    bytesLength: bytes.length,
    signatureLength: signature.length,
  })

  const result = await suiClient.core.executeTransaction({
    transaction: txBytes,
    signatures: [signature],
  })

  if ('$kind' in result && result.$kind === 'FailedTransaction') {
    throw new Error('Transaction failed')
  }

  return (
    (result as { Transaction: { digest?: string | null } }).Transaction
      ?.digest ?? null
  )
}

export const refetchTransferQueries = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: ['coin-balance'] })
  queryClient.invalidateQueries({ queryKey: ['transactions'] })

  void Promise.all([
    queryClient.refetchQueries({ queryKey: ['coin-balance'], type: 'all' }),
    queryClient.refetchQueries({ queryKey: ['transactions'], type: 'all' }),
  ])
}

export const useDelayedTransferRefetch = (queryClient: QueryClient) => {
  const postTransferRefetchTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null)

  useEffect(() => {
    return () => {
      if (postTransferRefetchTimerRef.current != null) {
        clearTimeout(postTransferRefetchTimerRef.current)
        postTransferRefetchTimerRef.current = null
      }
    }
  }, [])

  return () => {
    if (postTransferRefetchTimerRef.current != null) {
      clearTimeout(postTransferRefetchTimerRef.current)
    }

    postTransferRefetchTimerRef.current = setTimeout(() => {
      postTransferRefetchTimerRef.current = null
      void queryClient.refetchQueries({
        queryKey: ['coin-balance'],
        type: 'all',
      })
      void queryClient.refetchQueries({
        queryKey: ['transactions'],
        type: 'all',
      })
    }, BALANCE_REFETCH_DELAY_MS)
  }
}
