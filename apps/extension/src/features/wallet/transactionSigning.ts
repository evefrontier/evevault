import type { ParsedTransactionWithDisplay } from '@evevault/shared/types'
import { buildTx } from '@evevault/shared/utils'
import type { SuiGrpcClient } from '@mysten/sui/grpc'
import { Transaction } from '@mysten/sui/transactions'
import type { useSignPopupAuth } from './hooks/useSignPopupAuth'

type SignPopupAuth = ReturnType<typeof useSignPopupAuth>

type SignTransactionData = (
  scope: 'TransactionData',
  msgBytes: Uint8Array,
) => Promise<{ bytes: string; signature: string }>

export function assertCanSign(auth: SignPopupAuth, isLocalnet: boolean) {
  if (!auth.user) {
    throw new Error('No user found')
  }

  if (isLocalnet) return

  if (!auth.ephemeralPublicKey) {
    throw new Error('Ephemeral public key not found')
  }
  if (!auth.maxEpoch) {
    throw new Error('Max epoch is not set')
  }
}

export async function prepareAndSignTransaction({
  pendingTransaction,
  auth,
  getSenderAddress,
  isLocalnet,
  sign,
  suiClient,
}: {
  pendingTransaction: ParsedTransactionWithDisplay
  auth: SignPopupAuth
  getSenderAddress: () => Promise<string | null>
  isLocalnet: boolean
  sign: SignTransactionData
  suiClient: SuiGrpcClient
}) {
  assertCanSign(auth, isLocalnet)

  const senderAddress = await getSenderAddress()
  if (!senderAddress) {
    throw new Error(
      isLocalnet
        ? 'No localnet keypair loaded. Enter your private key in the network selector.'
        : 'User address not found',
    )
  }

  const txb = await buildTx(
    Transaction.from(pendingTransaction.transaction),
    senderAddress,
    suiClient,
  )
  const { bytes, signature } = await sign('TransactionData', txb)

  return {
    txb,
    bytes,
    signature,
    windowId: pendingTransaction.windowId,
  }
}
