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
  const durationMs = Number(DEFAULT_EPOCH_DURATION_MS)

  log.debug('Fetched epoch via gRPC', { epoch, startMs, durationMs })

  return {
    numericMaxEpoch: epoch,
    maxEpochTimestampMs: startMs + durationMs,
  }
}
