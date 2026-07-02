import type { SuiGrpcClient } from '@mysten/sui/grpc'
import { Transaction } from '@mysten/sui/transactions'
import { createLogger } from '#/utils'
import {
  ADDRESS_ALIAS_MODULE,
  ADDRESS_ALIAS_STATE,
  ALIAS_GAS_BUDGET,
} from './useAliases.config'

const log = createLogger()

type SignFn = (
  scope: 'TransactionData',
  bytes: Uint8Array,
) => Promise<{ bytes: string; signature: string }>

type ExecuteAliasTransactionParams = {
  suiClient: SuiGrpcClient
  getSenderAddress: () => Promise<string | null>
  sign: SignFn
  /** Builds the transaction bytes for the specific alias action. */
  buildBytes: (
    senderAddress: string,
    suiClient: SuiGrpcClient,
  ) => Promise<Uint8Array>
}

/**
 * Enable alias configuration for the sender. Creates the caller's AddressAliases
 * object. Assumes `enable` transfers the object internally (matching the CLI, which
 * does not transfer a returned value). If it instead RETURNS the object, capture the
 * result and `tx.transferObjects([result], sender)`.
 */
export async function enableAliasTxBytes(
  senderAddress: string,
  suiClient: SuiGrpcClient,
): Promise<Uint8Array> {
  const tx = new Transaction()

  tx.moveCall({
    target: `${ADDRESS_ALIAS_MODULE}::enable`,
    arguments: [tx.object(ADDRESS_ALIAS_STATE)],
  })

  tx.setSender(senderAddress)
  tx.setGasBudget(ALIAS_GAS_BUDGET)
  const txb = await tx.build({ client: suiClient })
  return new Uint8Array(txb)
}

/**
 * Add a new alias address to the caller's AddressAliases object.
 *
 * @param aliasesObjectId the caller's AddressAliases object id (from the read path)
 * @param alias the address to add as an alias
 */
export async function addAliasTxBytes(
  senderAddress: string,
  aliasesObjectId: string,
  alias: string,
  suiClient: SuiGrpcClient,
): Promise<Uint8Array> {
  const tx = new Transaction()

  tx.moveCall({
    target: `${ADDRESS_ALIAS_MODULE}::add`,
    arguments: [
      // tx.object(ADDRESS_ALIAS_STATE),
      tx.object(aliasesObjectId),
      tx.pure.address(alias),
    ],
  })

  tx.setSender(senderAddress)
  tx.setGasBudget(ALIAS_GAS_BUDGET)
  const txb = await tx.build({ client: suiClient })
  return new Uint8Array(txb)
}

/**
 * Signs and executes an alias PTB, returning the transaction digest.
 *
 * Mirrors `executeTokenTransfer`: resolve sender → build bytes → sign
 * `TransactionData` → execute via gRPC core → surface the digest.
 */
export const executeAliasTx = async ({
  suiClient,
  getSenderAddress,
  sign,
  buildBytes,
}: ExecuteAliasTransactionParams): Promise<string | null> => {
  const senderAddress = await requireSenderAddress(getSenderAddress)
  const txBytes = await buildBytes(senderAddress, suiClient)
  const { bytes, signature } = await sign('TransactionData', txBytes)

  log.debug('Alias transaction signed', {
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

const requireSenderAddress = async (
  getSenderAddress: () => Promise<string | null>,
): Promise<string> => {
  const senderAddress = await getSenderAddress()
  if (!senderAddress) {
    throw new Error('Wallet not ready to sign')
  }
  return senderAddress
}
