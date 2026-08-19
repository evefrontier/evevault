import { buildTransactionBytes } from '@evefrontier/wallet-core/crypto'
import { createSuiGraphQLClient } from '@evevault/shared/sui'
import { createLogger } from '@evevault/shared/utils'
import {
  simulateTransactionOutcome,
  type TransactionSimulation,
} from '@evevault/shared/wallet'
import type { SuiGrpcClient } from '@mysten/sui/grpc'
import { Transaction } from '@mysten/sui/transactions'
import { fromBase64 } from '@mysten/sui/utils'
import type { SuiChain } from '@mysten/wallet-standard'
import { useEffect, useRef, useState } from 'react'

const log = createLogger()

export type SimulationState =
  | { status: 'loading' }
  | { status: 'ready'; simulation: TransactionSimulation }
  // Transport/build failure — the outcome is unknown, distinct from a
  // transaction that simulates cleanly as a predicted on-chain failure.
  | { status: 'unavailable'; reason?: string }

type SimulationParams = {
  /**
   * The transaction payload to simulate, or null when nothing is pending.
   * - `build`: a serialized `Transaction` that still needs sender + gas
   *   resolved (the dApp sign / sign-and-execute path).
   * - `bytes`: base64 BCS `TransactionData` that is already fully built,
   *   including gas payment (the sponsored path — rebuilding would drop the
   *   sponsor's gas).
   */
  payload: string | null
  mode: 'build' | 'bytes'
  suiClient: SuiGrpcClient
  chain: SuiChain
  getSenderAddress: () => Promise<string | null>
  /** Used only to filter balance changes if `getSenderAddress` returns null. */
  fallbackSender?: string
}

async function resolveBytes(
  mode: 'build' | 'bytes',
  payload: string,
  sender: string,
  suiClient: SuiGrpcClient,
): Promise<Uint8Array> {
  if (mode === 'bytes') return fromBase64(payload)
  return buildTransactionBytes(Transaction.from(payload), sender, suiClient)
}

/**
 * Simulates the pending transaction as soon as it is decoded, re-running when
 * the selected network changes. Resolves the sender the same way the signing
 * path does (`getSenderAddress`) rather than from the dApp payload, whose
 * `account.address` does not survive the storage round-trip into the popup.
 */
export function useTransactionSimulation({
  payload,
  mode,
  suiClient,
  chain,
  getSenderAddress,
  fallbackSender,
}: SimulationParams): SimulationState | null {
  const [state, setState] = useState<SimulationState | null>(null)
  const runIdRef = useRef(0)

  useEffect(() => {
    if (!payload) {
      setState(null)
      return
    }

    const runId = ++runIdRef.current
    setState({ status: 'loading' })

    const run = async () => {
      try {
        const sender = (await getSenderAddress()) ?? fallbackSender
        if (!sender) {
          throw new Error('No sender address available')
        }
        const bytes = await resolveBytes(mode, payload, sender, suiClient)
        const simulation = await simulateTransactionOutcome({
          transactionBytes: bytes,
          sender,
          suiClient,
          graphqlClient: createSuiGraphQLClient(chain),
        })
        if (runId === runIdRef.current) {
          setState({ status: 'ready', simulation })
        }
      } catch (err) {
        log.warn('Transaction simulation failed', err)
        if (runId === runIdRef.current) {
          setState({
            status: 'unavailable',
            reason: err instanceof Error ? err.message : String(err),
          })
        }
      }
    }

    void run()
    // Discard this run's result if a newer one starts (e.g. network switch).
    return () => {
      runIdRef.current++
    }
  }, [payload, mode, suiClient, chain, getSenderAddress, fallbackSender])

  return state
}
