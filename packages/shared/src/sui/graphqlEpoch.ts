import {
  type ChainEpochInfo,
  computeEpochState,
} from '@evefrontier/wallet-core/epoch'
import type { SuiChain } from '@mysten/wallet-standard'
import { DEFAULT_EPOCH_DURATION_MS } from '#/utils/constants'
import { LOCAL_DEV, LOCAL_DEV_SESSION_EPOCHS } from '#/utils/localDev'
import { createLogger } from '#/utils/logger'
import { createSuiGraphQLClient } from './graphqlClient'
import { EPOCH_QUERY, LOCAL_DEV_EPOCH_QUERY } from './queries/epoch'
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
    query: LOCAL_DEV ? LOCAL_DEV_EPOCH_QUERY : EPOCH_QUERY,
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

  // GraphQL gives no end for the current epoch. LOCAL_DEV reads the chain's
  // epoch length from its system state: the stack's epochs are not 24 h.
  const localDevDurationMs = Number(
    epoch.systemState?.json?.parameters?.epoch_duration_ms,
  )
  const info: ChainEpochInfo = {
    currentEpoch: numericMaxEpoch,
    epochStartTimestampMs: startMs,
    epochDurationMs: epoch.endTimestamp
      ? new Date(epoch.endTimestamp).getTime() - startMs
      : LOCAL_DEV && localDevDurationMs > 0
        ? localDevDurationMs
        : DEFAULT_EPOCH_DURATION_MS,
  }
  // maxEpoch = current epoch (LOCAL_DEV: LOCAL_DEV_SESSION_EPOCHS more)
  const state = computeEpochState(info, {
    epochsFromCurrent: LOCAL_DEV ? LOCAL_DEV_SESSION_EPOCHS : 0,
    nowMs: Date.now(),
  })

  return {
    numericMaxEpoch: state.numericMaxEpoch,
    maxEpochTimestampMs: state.maxEpochTimestampMs,
  }
}
