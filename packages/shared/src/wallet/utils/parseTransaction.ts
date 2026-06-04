import type { SuiGraphQLClient } from '@mysten/sui/graphql'
import type {
  Transaction,
  TransactionBalanceChange,
  TransactionDirection,
} from '#/types/components'
import { isNonNullable, SUI_COIN_TYPE } from '#/utils'
import { formatByDecimals } from '#/utils/format'
import { createLogger } from '#/utils/logger'
import type {
  GraphQLBalanceChange,
  GraphQLTransactionNode,
} from '#/wallet/types/graphql'
import { fetchCoinMetadata } from './coinMetadata'
import { extractSymbolFromCoinType } from './formatTransaction'

const log = createLogger()

function findCounterparty(
  balanceChanges: GraphQLBalanceChange[],
  userAddress: string,
  direction: TransactionDirection,
  coinType: string,
): string {
  const isReceived = direction === 'received'
  const oppositeSign = isReceived
    ? (amount: bigint) => amount < 0n
    : (amount: bigint) => amount > 0n
  const sameCoinType = (bc: GraphQLBalanceChange) =>
    (bc.coinType?.repr ?? SUI_COIN_TYPE) === coinType
  const notUser = (bc: GraphQLBalanceChange) =>
    bc.owner?.address?.toLowerCase() !== userAddress.toLowerCase()

  const withOppositeSign = balanceChanges.filter((bc) => {
    if (!bc.amount) return false
    return oppositeSign(BigInt(bc.amount)) && notUser(bc)
  })
  const sameCoin = withOppositeSign.find(sameCoinType)
  const counterpartyChange = sameCoin ?? withOppositeSign[0]
  return counterpartyChange?.owner?.address ?? 'System'
}

/**
 * Parses a GraphQL transaction response into our Transaction format.
 * Returns one Transaction per digest with all user balance changes (e.g. EVE + SUI gas) in one row.
 */
export async function parseGraphQLTransaction(
  txNode: GraphQLTransactionNode,
  userAddress: string,
  graphqlClient: SuiGraphQLClient,
): Promise<Transaction | null> {
  const context = getTransactionContext(txNode)
  const parsedTransaction =
    context &&
    ((await buildUserBalanceTransaction(context, userAddress, graphqlClient)) ??
      (await buildOutgoingBalanceTransaction(
        context,
        userAddress,
        graphqlClient,
      )))

  return parsedTransaction || null
}

type TransactionContext = {
  digest: string
  timestamp: number
  balanceChanges: GraphQLBalanceChange[]
}

const getTransactionContext = (
  txNode: GraphQLTransactionNode,
): TransactionContext | null => {
  const { digest, effects } = txNode
  const balanceChanges = effects?.balanceChanges?.nodes
  return digest && effects && balanceChanges?.length
    ? {
        digest,
        timestamp: effects.timestamp
          ? new Date(effects.timestamp).getTime()
          : Date.now(),
        balanceChanges,
      }
    : null
}

const buildUserBalanceTransaction = async (
  context: TransactionContext,
  userAddress: string,
  graphqlClient: SuiGraphQLClient,
): Promise<Transaction | null> => {
  const userChanges = getUserBalanceChanges(context.balanceChanges, userAddress)
  const balanceChangeItems = await buildBalanceChangeItems(
    userChanges,
    graphqlClient,
  )
  const primary = getPrimaryUserChange(userChanges, balanceChangeItems)

  return primary
    ? {
        digest: context.digest,
        timestamp: context.timestamp,
        direction: primary.direction,
        counterparty: findCounterparty(
          context.balanceChanges,
          userAddress,
          primary.direction,
          primary.coinType,
        ),
        balanceChanges: balanceChangeItems,
      }
    : null
}

const buildOutgoingBalanceTransaction = async (
  context: TransactionContext,
  userAddress: string,
  graphqlClient: SuiGraphQLClient,
): Promise<Transaction | null> => {
  const outgoingChange = context.balanceChanges.find(isOutgoingChange)
  const balanceChange = outgoingChange
    ? await buildOutgoingBalanceChange(outgoingChange, graphqlClient)
    : null

  return balanceChange
    ? {
        digest: context.digest,
        timestamp: context.timestamp,
        direction: 'sent',
        counterparty: findRecipientCounterparty(
          context.balanceChanges,
          userAddress,
        ),
        balanceChanges: [balanceChange],
      }
    : null
}

const getUserBalanceChanges = (
  balanceChanges: GraphQLBalanceChange[],
  userAddress: string,
): GraphQLBalanceChange[] => {
  return balanceChanges.filter((bc) => {
    const owner = bc.owner?.address
    return (
      owner?.toLowerCase() === userAddress.toLowerCase() && bc.amount != null
    )
  })
}

const buildBalanceChangeItems = async (
  userChanges: GraphQLBalanceChange[],
  graphqlClient: SuiGraphQLClient,
): Promise<TransactionBalanceChange[]> => {
  const items: TransactionBalanceChange[] = []
  for (const change of userChanges) {
    if (!hasAmount(change)) continue
    items.push(await buildBalanceChangeItem(change, graphqlClient))
  }
  return items.filter(Boolean)
}

const buildBalanceChangeItem = async (
  change: GraphQLBalanceChange,
  graphqlClient: SuiGraphQLClient,
): Promise<TransactionBalanceChange> => {
  const amount = BigInt(change.amount ?? '0')
  const amountAbs = absBigInt(amount)
  const coinType = getCoinType(change)
  const metadata = await fetchCoinMetadata(graphqlClient, coinType)
  const decimals = metadata?.decimals ?? 9
  logMetadataFallback(metadata, coinType, amountAbs, decimals)

  return {
    amount: formatByDecimals(amountAbs.toString(), decimals),
    tokenSymbol: metadata?.symbol ?? extractSymbolFromCoinType(coinType),
    tokenName: metadata?.name ?? undefined,
    coinType,
    isDebit: amount < 0n,
  }
}

const buildOutgoingBalanceChange = async (
  outgoingChange: GraphQLBalanceChange,
  graphqlClient: SuiGraphQLClient,
): Promise<TransactionBalanceChange | null> => {
  return outgoingChange.amount
    ? buildBalanceChangeItem(outgoingChange, graphqlClient)
    : null
}

const getPrimaryUserChange = (
  userChanges: GraphQLBalanceChange[],
  balanceChangeItems: TransactionBalanceChange[],
): { direction: TransactionDirection; coinType: string } | null => {
  const primaryUserChange =
    userChanges.find(isNonSuiAmountChange) ?? userChanges.find(hasAmount)
  const primaryAmount = BigInt(primaryUserChange?.amount ?? '0')
  const primaryCoinType = getCoinType(primaryUserChange)
  const primary =
    balanceChangeItems.find((bc) => bc.coinType === primaryCoinType) ??
    balanceChangeItems.find((bc) => bc.coinType !== SUI_COIN_TYPE) ??
    balanceChangeItems[0]

  return primary
    ? {
        direction: primaryAmount >= 0n ? 'received' : 'sent',
        coinType: primary.coinType,
      }
    : null
}

const findRecipientCounterparty = (
  balanceChanges: GraphQLBalanceChange[],
  userAddress: string,
): string => {
  const recipientChange = balanceChanges.find((bc) => {
    const ownerAddress = bc.owner?.address
    return (
      Boolean(bc.amount) &&
      BigInt(bc.amount ?? '0') > 0n &&
      ownerAddress?.toLowerCase() !== userAddress.toLowerCase()
    )
  })
  return recipientChange?.owner?.address ?? 'System'
}

const isOutgoingChange = (bc: GraphQLBalanceChange): boolean => {
  return Boolean(bc.amount) && BigInt(bc.amount ?? '0') < 0n
}

const isNonSuiAmountChange = (change: GraphQLBalanceChange): boolean => {
  return getCoinType(change) !== SUI_COIN_TYPE && hasAmount(change)
}

const hasAmount = (change: GraphQLBalanceChange): boolean => {
  return isNonNullable(change.amount)
}

const getCoinType = (change?: GraphQLBalanceChange): string => {
  return change?.coinType?.repr ?? SUI_COIN_TYPE
}

const absBigInt = (amount: bigint): bigint => {
  return amount >= 0n ? amount : amount * -1n
}

const logMetadataFallback = (
  metadata: unknown,
  coinType: string,
  rawAmount: bigint,
  defaultDecimals: number,
) => {
  if (!metadata) {
    log.warn('Falling back to default decimals for coin type', {
      coinType,
      rawAmount: rawAmount.toString(),
      defaultDecimals,
    })
  }
}
