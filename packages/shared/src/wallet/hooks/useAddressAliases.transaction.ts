import type { SuiGrpcClient } from '@mysten/sui/grpc'
import { Transaction } from '@mysten/sui/transactions'
import { createLogger } from '#/utils'
import {
  ADDRESS_ALIAS_GAS_BUDGET,
  ADDRESS_ALIAS_MODULE,
  ADDRESS_ALIAS_STATE,
} from './useAddressAliases.config'

const log = createLogger()

type SignFn = (
  scope: 'TransactionData',
  bytes: Uint8Array,
) => Promise<{ bytes: string; signature: string }>

type ExecuteAddressAliasTransactionParams = {
  suiClient: SuiGrpcClient
  getSenderAddress: () => Promise<string | null>
  sign: SignFn
  /** Builds the transaction bytes for the specific address alias action. */
  buildBytes: (
    senderAddress: string,
    suiClient: SuiGrpcClient,
  ) => Promise<Uint8Array>
}

/**
 * Enable address alias configuration for the sender. Creates the caller's
 * AddressAliases object. Assumes `enable` transfers the object internally
 * (matching the CLI, which does not transfer a returned value). If it instead
 * RETURNS the object, capture the result and `tx.transferObjects([result], sender)`.
 */
export async function enableAddressAliasTxBytes(
  senderAddress: string,
  suiClient: SuiGrpcClient,
): Promise<Uint8Array> {
  const tx = new Transaction()

  tx.moveCall({
    target: `${ADDRESS_ALIAS_MODULE}::enable`,
    arguments: [tx.object(ADDRESS_ALIAS_STATE)],
  })

  tx.setSender(senderAddress)
  tx.setGasBudget(ADDRESS_ALIAS_GAS_BUDGET)
  const txb = await tx.build({ client: suiClient })
  return new Uint8Array(txb)
}

/**
 * Add a new address alias to the caller's AddressAliases object.
 *
 * @param aliasesObjectId the caller's AddressAliases object id (from the read path)
 * @param addressAlias the address to add as an address alias
 */
export async function addAddressAliasTxBytes(
  senderAddress: string,
  aliasesObjectId: string,
  addressAlias: string,
  suiClient: SuiGrpcClient,
): Promise<Uint8Array> {
  const tx = new Transaction()

  tx.moveCall({
    target: `${ADDRESS_ALIAS_MODULE}::add`,
    arguments: [
      // tx.object(ADDRESS_ALIAS_STATE),
      tx.object(aliasesObjectId),
      tx.pure.address(addressAlias),
    ],
  })

  tx.setSender(senderAddress)
  tx.setGasBudget(ADDRESS_ALIAS_GAS_BUDGET)
  const txb = await tx.build({ client: suiClient })
  return new Uint8Array(txb)
}

/**
 * Signs and executes an address alias PTB, returning the transaction digest.
 *
 * Mirrors `executeTokenTransfer`: resolve sender → build bytes → sign
 * `TransactionData` → execute via gRPC core → surface the digest.
 */
export const executeAddressAliasTx = async ({
  suiClient,
  getSenderAddress,
  sign,
  buildBytes,
}: ExecuteAddressAliasTransactionParams): Promise<string | null> => {
  const senderAddress = await requireSenderAddress(getSenderAddress)
  const txBytes = await buildBytes(senderAddress, suiClient)
  const { bytes, signature } = await sign('TransactionData', txBytes)

  log.debug('Address alias transaction signed', {
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
