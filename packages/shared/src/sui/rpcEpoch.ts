import {
  type ChainEpochInfo,
  computeEpochState,
} from '@evefrontier/wallet-core/epoch'
import { SUI_LOCALNET_CHAIN } from '@mysten/wallet-standard'
import { DEFAULT_EPOCH_DURATION_MS } from '#/utils/constants'
import { createLogger } from '#/utils/logger'
import { createSuiClient } from './suiClient'

const log = createLogger()

/**
 * Fetches current epoch via GRPC for localnet.
 * Returns the same shape as getCurrentEpochFromGraphQL so callers are interchangeable.
 */
export async function getCurrentEpochFromRpc(fullnodeUrl: string): Promise<{
  numericMaxEpoch: number
  maxEpochTimestampMs: number
}> {
  const client = createSuiClient(SUI_LOCALNET_CHAIN, fullnodeUrl)

  const epochResponse = await client.ledgerService
    .getEpoch({})
    .response.then((response) => response.epoch)

  const epoch = Number(epochResponse?.epoch ?? 0)
  const startMs = Number(epochResponse?.start ?? 0)

  log.debug('Fetched epoch via gRPC', {
    epoch,
    startMs,
    durationMs: DEFAULT_EPOCH_DURATION_MS,
  })

  const info: ChainEpochInfo = {
    currentEpoch: epoch,
    epochStartTimestampMs: startMs,
    epochDurationMs: DEFAULT_EPOCH_DURATION_MS,
  }
  // epochsFromCurrent: 0 binds maxEpoch to the current epoch — no buffer.
  const state = computeEpochState(info, {
    epochsFromCurrent: 0,
    nowMs: Date.now(),
  })

  return {
    numericMaxEpoch: state.numericMaxEpoch,
    maxEpochTimestampMs: state.maxEpochTimestampMs,
  }
}
