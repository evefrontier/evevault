import {
  type ChainEpochInfo,
  computeEpochState,
} from '@evefrontier/wallet-core/epoch'
import type { SuiChain } from '@mysten/wallet-standard'
import { DEFAULT_EPOCH_DURATION_MS } from '#/utils/constants'
import { createLogger } from '#/utils/logger'
import { createSuiGraphQLClient } from './graphqlClient'
import { EPOCH_QUERY } from './queries/epoch'
import type { EpochQueryResponse } from './types'

const log = createLogger()

/**
 * Fetches current epoch and its end timestamp via Sui GraphQL (non-deprecated).
 * Used for zkLogin device/nonce setup; avoids relying on gRPC on JSON-RPC-only endpoints.
 */
export async function getCurrentEpochFromGraphQL(chain: SuiChain): Promise<{
  numericMaxEpoch: number
  maxEpochTimestampMs: number
}> {
  const client = createSuiGraphQLClient(chain)
  const result = await client.query<EpochQueryResponse>({
    query: EPOCH_QUERY,
    variables: {},
  })

  if (result.errors?.length) {
    const message = result.errors.map((e) => e.message).join(', ')
    throw new Error(`GraphQL epoch query failed: ${message}`)
  }

  const epoch = result.data?.epoch
  if (!epoch) {
    throw new Error('Failed to get epoch data from GraphQL')
  }

  const numericMaxEpoch = Number(epoch.epochId)
  const startMs = epoch.startTimestamp
    ? new Date(epoch.startTimestamp).getTime()
    : 0

  if (!epoch.endTimestamp) {
    log.debug('Epoch endTimestamp missing; using start + 24h fallback', {
      chain,
      epochId: numericMaxEpoch,
    })
  }

  const info: ChainEpochInfo = {
    currentEpoch: numericMaxEpoch,
    epochStartTimestampMs: startMs,
    epochDurationMs: epoch.endTimestamp
      ? new Date(epoch.endTimestamp).getTime() - startMs
      : DEFAULT_EPOCH_DURATION_MS,
  }
  // maxEpoch = current epoch
  const state = computeEpochState(info, {
    epochsFromCurrent: 0,
    nowMs: Date.now(),
  })

  return {
    numericMaxEpoch: state.numericMaxEpoch,
    maxEpochTimestampMs: state.maxEpochTimestampMs,
  }
}
