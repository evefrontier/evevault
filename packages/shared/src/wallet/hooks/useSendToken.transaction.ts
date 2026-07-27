import type { SuiGrpcClient } from '@mysten/sui/grpc'
import { Transaction } from '@mysten/sui/transactions'
import { createLogger, isSuiCoinType, toSmallestUnit } from '#/utils'

type CoinWithBalance = { balance: string; objectId: string }

type ExecuteTransferParams = {
  amount: string
  coinType: string
  decimals: number
  recipientAddress: string
  suiClient: SuiGrpcClient
  getSenderAddress: () => Promise<string | null>
  sign: (
    scope: 'TransactionData',
    bytes: Uint8Array,
  ) => Promise<{ bytes: string; signature: string }>
}

const log = createLogger()

/** SUI uses the gas coin directly (splitCoins from gas); other tokens require fetching coin objects and potentially merging them. */
export async function buildTransferTransactionBytes(
  senderAddress: string,
  recipientAddress: string,
  amountInSmallestUnit: bigint,
  coinType: string,
  suiClient: SuiGrpcClient,
): Promise<Uint8Array> {
  const tx = new Transaction()
  tx.setSender(senderAddress)

  if (isSuiCoinType(coinType)) {
    addSuiTransfer(tx, recipientAddress, amountInSmallestUnit)
  } else {
    await addTokenTransfer(tx, {
      senderAddress,
      recipientAddress,
      amountInSmallestUnit,
      coinType,
      suiClient,
    })
  }

  const txb = await tx.build({ client: suiClient })
  return new Uint8Array(txb)
}

export const executeTokenTransfer = async ({
  amount,
  coinType,
  decimals,
  recipientAddress,
  suiClient,
  getSenderAddress,
  sign,
}: ExecuteTransferParams): Promise<string | null> => {
  const senderAddress = await requireSenderAddress(getSenderAddress)
  const txBytes = await buildTransferTransactionBytes(
    senderAddress,
    recipientAddress,
    toSmallestUnit(amount, decimals),
    coinType,
    suiClient,
  )
  const { bytes, signature } = await sign('TransactionData', txBytes)

  log.debug('Transaction signed', {
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

const addSuiTransfer = (
  tx: Transaction,
  recipientAddress: string,
  amountInSmallestUnit: bigint,
) => {
  const [coin] = tx.splitCoins(tx.gas, [amountInSmallestUnit])
  tx.transferObjects([coin], recipientAddress)
}

/** Merges all coin objects into the primary when no single coin has enough balance, then splits the exact amount. */
const addTokenTransfer = async (
  tx: Transaction,
  {
    senderAddress,
    recipientAddress,
    amountInSmallestUnit,
    coinType,
    suiClient,
  }: {
    senderAddress: string
    recipientAddress: string
    amountInSmallestUnit: bigint
    coinType: string
    suiClient: SuiGrpcClient
  },
) => {
  const { objects: coinObjects } = await suiClient.listCoins({
    owner: senderAddress,
    coinType,
  })
  const suitableCoin = coinObjects.find(
    (coin: CoinWithBalance) => BigInt(coin.balance) >= amountInSmallestUnit,
  )
  const primaryCoin =
    suitableCoin ?? getPrimaryCoinForTransfer(coinObjects, amountInSmallestUnit)

  mergeCoinsIfNeeded(tx, primaryCoin, suitableCoin, coinObjects)
  const coinObjectId = suitableCoin?.objectId ?? primaryCoin.objectId
  const [coin] = tx.splitCoins(tx.object(coinObjectId), [amountInSmallestUnit])
  tx.transferObjects([coin], recipientAddress)
}

const getPrimaryCoinForTransfer = (
  coinObjects: CoinWithBalance[],
  amountInSmallestUnit: bigint,
): CoinWithBalance => {
  if (coinObjects.length === 0) {
    throw new Error('No coins found for this token')
  }

  const totalBalance = coinObjects.reduce(
    (sum: bigint, coin: CoinWithBalance) => sum + BigInt(coin.balance),
    0n,
  )
  if (totalBalance < amountInSmallestUnit) {
    throw new Error('Token balance changed during transaction preparation')
  }

  return coinObjects[0]
}

/** Only merges when no single coin covers the amount; avoids unnecessary merge operations that would touch extra objects. */
const mergeCoinsIfNeeded = (
  tx: Transaction,
  primaryCoin: CoinWithBalance,
  suitableCoin: CoinWithBalance | undefined,
  coinObjects: CoinWithBalance[],
) => {
  const otherCoins = suitableCoin ? [] : coinObjects.slice(1)
  if (otherCoins.length > 0) {
    tx.mergeCoins(
      tx.object(primaryCoin.objectId),
      otherCoins.map((coin: CoinWithBalance) => tx.object(coin.objectId)),
    )
  }
}
