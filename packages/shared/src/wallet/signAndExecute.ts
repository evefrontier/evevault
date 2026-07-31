import type { SuiGrpcClient } from '@mysten/sui/grpc'
import type { SuiChain } from '@mysten/wallet-standard'
import { createLogger } from '#/utils/logger'
import { withZkLoginEpochRetry } from './zkEpochRetry'

const log = createLogger()

/** Thrown when the network accepts the submission but reports a failed transaction. */
export class TransactionFailedError extends Error {
  constructor() {
    super('Transaction failed')
    this.name = 'TransactionFailedError'
  }
}

type SignTransactionFn = (
  scope: 'TransactionData',
  bytes: Uint8Array,
) => Promise<{ bytes: string; signature: string }>

/**
 * Signs pre-built transaction bytes and submits them, returning the digest.
 *
 * Handles zkLogin proof expiry transparently: proofs are valid for at most one
 * epoch (see withZkLoginEpochRetry), so the fullnode may reject the signature
 * with a "zkLogin expired at epoch N" error. When that happens, the ephemeral
 * key is rotated (fresh nonce, fresh JWT, fresh proof) and the SAME txBytes
 * are re-signed and resubmitted — once. Rotation does not change the zkLogin
 * address, so bytes built before the retry stay valid. Any other error, or a
 * second expiry rejection, propagates to the caller.
 *
 * Throws TransactionFailedError when the chain executes the transaction but
 * reports it as failed, or when a successful response is missing a digest
 * (this is never retried).
 */
export const signAndExecuteTransaction = async ({
  chain,
  suiClient,
  txBytes,
  sign,
}: {
  chain: SuiChain
  suiClient: SuiGrpcClient
  txBytes: Uint8Array
  sign: SignTransactionFn
}): Promise<string> =>
  withZkLoginEpochRetry(chain, async () => {
    const { signature } = await sign('TransactionData', txBytes)

    log.debug('Transaction signed', {
      bytesLength: txBytes.length,
      signatureLength: signature.length,
    })

    const result = await suiClient.core.executeTransaction({
      transaction: txBytes,
      signatures: [signature],
    })

    // @mysten/sui 2.x: discriminated union Transaction | FailedTransaction
    if ('$kind' in result && result.$kind === 'FailedTransaction') {
      throw new TransactionFailedError()
    }

    const digest = (result as { Transaction: { digest?: string | null } })
      .Transaction?.digest
    if (!digest) {
      throw new TransactionFailedError()
    }
    log.info('Transaction executed', { digest })
    return digest
  })
