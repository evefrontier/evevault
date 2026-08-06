import {
  computeEpochState,
  fetchEpochFromSystemState,
} from '@evefrontier/wallet-core/epoch'
import { SUI_LOCALNET_CHAIN } from '@mysten/wallet-standard'
import { createLogger } from '#/utils/logger'
import { createSuiClient } from './suiClient'

const log = createLogger()

/**
 * Fetches current epoch via GRPC for localnet from the on-chain system-state object.
 * Returns the same shape as getCurrentEpochFromGraphQL so callers are interchangeable.
 */
export async function getCurrentEpochFromRpc(fullnodeUrl: string): Promise<{
  numericMaxEpoch: number
  maxEpochTimestampMs: number
}> {
  const client = createSuiClient(SUI_LOCALNET_CHAIN, fullnodeUrl)

  const info = await fetchEpochFromSystemState(client)
  log.debug('Fetched epoch via gRPC system state', info)

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
