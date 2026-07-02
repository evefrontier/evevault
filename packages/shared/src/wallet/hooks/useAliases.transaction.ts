import type { SuiGrpcClient } from '@mysten/sui/grpc'
import { Transaction } from '@mysten/sui/transactions'
import { createLogger } from '#/utils'
import { ADDRESS_ALIAS_MODULE, ADDRESS_ALIAS_STATE } from './useAliases.config'

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
 * Builds the PTB that mints the caller's `AddressAliases` object (the on-chain
 * opt-in to aliasing).
 *
 * TODO(abi): the `sui::address_alias` module ABI is unconfirmed — the package,
 * function name, argument order, and whether `enable` returns an object to
 * transfer are all guesses. Wire up the real `tx.moveCall(...)` once the module
 * ABI is known, then remove the throw below.
 */
export async function buildEnableAliasesTx(
  senderAddress: string,
  _suiClient: SuiGrpcClient,
): Promise<Uint8Array> {
  const tx = new Transaction()
  tx.setSender(senderAddress)

  // TODO(abi): e.g. tx.moveCall({ target: `${ADDRESS_ALIAS_MODULE}::enable`, arguments: [tx.object(ADDRESS_ALIAS_STATE)] })
  void ADDRESS_ALIAS_MODULE
  void ADDRESS_ALIAS_STATE
  throw new Error(
    'Enable-aliasing transaction not yet implemented (address_alias ABI unconfirmed)',
  )
}

/**
 * Builds the PTB that registers `alias` as an alias of the caller's address.
 *
 * TODO(abi): unconfirmed module ABI — see {@link buildEnableAliasesTx}. Wire up
 * the real `tx.moveCall(...)` (likely takes the owned `AddressAliases` object id
 * and the alias address) once the ABI is known, then remove the throw.
 */
export async function buildAddAliasTx(
  senderAddress: string,
  _aliasesObjectId: string,
  _alias: string,
  _suiClient: SuiGrpcClient,
): Promise<Uint8Array> {
  const tx = new Transaction()
  tx.setSender(senderAddress)

  // TODO(abi): e.g. tx.moveCall({ target: `${ADDRESS_ALIAS_MODULE}::add_alias`, arguments: [tx.object(aliasesObjectId), tx.pure.address(alias)] })
  throw new Error(
    'Add-alias transaction not yet implemented (address_alias ABI unconfirmed)',
  )
}

/**
 * Signs and executes an alias PTB, returning the transaction digest.
 *
 * Mirrors `executeTokenTransfer`: resolve sender → build bytes → sign
 * `TransactionData` → execute via gRPC core → surface the digest.
 */
export const executeAliasTransaction = async ({
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
