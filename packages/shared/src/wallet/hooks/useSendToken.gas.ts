import type { SuiGrpcClient } from '@mysten/sui/grpc'
import { useEffect, useRef, useState } from 'react'
import { createLogger, formatMistToSui, toSmallestUnit } from '#/utils'
import { buildTransferTransactionBytes } from './useSendToken.transaction'

type GasEstimateParams = {
  formValidForEstimate: boolean
  suiClient: SuiGrpcClient
  getSenderAddress: () => Promise<string | null>
  amount: string
  decimals: number
  recipientAddress: string
  coinType: string
}

type GasUsedShape = {
  computationCost?: string
  storageCost?: string
  storageRebate?: string
  nonRefundableStorageFee?: string
}

type EstimateGasMistParams = Omit<GasEstimateParams, 'formValidForEstimate'>

type SimulateResult =
  | {
      $kind: 'Transaction'
      Transaction: { effects?: { gasUsed?: GasUsedShape } }
    }
  | {
      $kind: 'FailedTransaction'
      FailedTransaction: { effects?: { gasUsed?: GasUsedShape } }
    }

type EstimateGasFeeTaskParams = EstimateGasMistParams & {
  runId: number
  estimateRunIdRef: { current: number }
  setEstimatedGasFee: (value: string | null) => void
  setEstimatedGasFeeLoading: (value: boolean) => void
}

const log = createLogger()
const ESTIMATE_DEBOUNCE_MS = 600

/** Debounces estimation to avoid firing a simulation on every keystroke; uses a runId to discard stale results from overlapping requests. */
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

/** Works on both `Transaction` and `FailedTransaction` response shapes since a failed simulation still reports gas consumed. */
export function parseGasUsedFromSimulation(result: unknown): string | null {
  try {
    const gasUsed = getSimulationGasUsed(result)
    const total = gasUsed ? calculateTotalGas(gasUsed) : 0n
    return total > 0n ? total.toString() : null
  } catch {
    return null
  }
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
      suiClient,
      getSenderAddress,
      amount,
      decimals,
      recipientAddress,
      coinType,
    })
    updateEstimateState(runId, estimateRunIdRef, setEstimatedGasFee, mist)
  } catch (err) {
    log.warn('Gas estimation failed', { err })
    updateEstimateState(runId, estimateRunIdRef, setEstimatedGasFee, null)
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
}: EstimateGasMistParams): Promise<string | null> => {
  const senderAddress = await getSenderAddress()
  if (!senderAddress) {
    return null
  }

  const txBytes = await buildTransferTransactionBytes(
    senderAddress,
    recipientAddress,
    toSmallestUnit(amount, decimals),
    coinType,
    suiClient,
  )
  const sim = await suiClient.simulateTransaction({
    transaction: txBytes,
    include: { effects: true },
  })
  return parseGasUsedFromSimulation(sim)
}

/** Guards against out-of-order async responses — only the most recent estimate updates the displayed fee. */
const updateEstimateState = (
  runId: number,
  estimateRunIdRef: { current: number },
  setEstimatedGasFee: (value: string | null) => void,
  mist: string | null,
) => {
  if (runId === estimateRunIdRef.current) {
    setEstimatedGasFee(mist ? formatMistToSui(mist) : null)
  }
}

const getSimulationGasUsed = (result: unknown): GasUsedShape | undefined => {
  const r = result as SimulateResult
  return r?.$kind === 'Transaction'
    ? r.Transaction?.effects?.gasUsed
    : r?.$kind === 'FailedTransaction'
      ? r.FailedTransaction?.effects?.gasUsed
      : undefined
}

const calculateTotalGas = (gasUsed: GasUsedShape): bigint => {
  // Net gas = computation + storage − rebate. nonRefundableStorageFee is the
  // slice of the rebate that is withheld and is already reflected in
  // storageRebate; adding it again would double-count it.
  return (
    BigInt(gasUsed.computationCost ?? '0') +
    BigInt(gasUsed.storageCost ?? '0') -
    BigInt(gasUsed.storageRebate ?? '0')
  )
}
