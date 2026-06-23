import { buildTransactionBytes } from '@evefrontier/wallet-core/crypto'
import type { ParsedTransactionWithDisplay } from '@evevault/shared/types'
import type { SuiGrpcClient } from '@mysten/sui/grpc'
import { Transaction } from '@mysten/sui/transactions'

type SignAuth = {
  user: unknown
  ephemeralPublicKey: unknown
  maxEpoch: unknown
}

type SignTransactionData = (
  scope: 'TransactionData',
  msgBytes: Uint8Array,
) => Promise<{ bytes: string; signature: string }>

export function assertCanSign(auth: SignAuth, isLocalnet: boolean) {
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
  auth: SignAuth
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

  const txb = await buildTransactionBytes(
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
