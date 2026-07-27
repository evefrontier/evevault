import { isEveCoinType } from '@evefrontier/wallet-core/eve-token'
import { SUI_LOCALNET_CHAIN } from '@mysten/wallet-standard'
import { createSuiClient } from '#/sui'
import type { createSuiGraphQLClient } from '#/sui/graphqlClient'
import { formatByDecimals, formatMistToSui, isSuiCoinType } from '#/utils'
import { createLogger } from '#/utils/logger'
import {
  BALANCE_AND_METADATA_QUERY,
  LATEST_CHECKPOINT_QUERY,
} from '#/wallet/queries/balance'
import type {
  BalanceAndMetadataResponse,
  LatestCheckpointResponse,
} from '#/wallet/types/graphql'
import type { BalanceMetadata, CoinBalanceResult } from '#/wallet/types/hooks'
import {
  DEFAULT_EVE_TESTNET_METADATA,
  DEFAULT_SUI_METADATA,
} from '#/wallet/utils/balanceMetadata'

const log = createLogger()

type GraphQLClient = ReturnType<typeof createSuiGraphQLClient>

export type BalanceQueryParams = {
  activeAddress: string
  coinType: string
  isLocalnet: boolean
  localnetUrl?: string
  graphqlClient: GraphQLClient | null
}

/** Routes between localnet (gRPC RPC) and zkLogin chains (GraphQL) since localnet has no GraphQL endpoint. */
export async function fetchBalanceForChain({
  activeAddress,
  coinType,
  isLocalnet,
  localnetUrl,
  graphqlClient,
}: BalanceQueryParams): Promise<CoinBalanceResult> {
  if (isLocalnet) {
    if (!localnetUrl) {
      throw new Error('localnetUrl required for localnet balance')
    }
    return fetchLocalnetBalanceViaGrpc(localnetUrl, activeAddress, coinType)
  }

  if (!graphqlClient) {
    throw new Error('Missing GraphQL client')
  }

  const data = await fetchZkLoginBalanceWithCheckpointRetry(
    graphqlClient,
    activeAddress,
    coinType,
  )
  return buildGraphqlBalanceResult(data, coinType)
}

/** Fetches the latest checkpoint first so the balance query is pinned to a consistent point in time. */
async function fetchZkLoginBalanceViaGraphql(
  graphqlClient: GraphQLClient,
  address: string,
  coinType: string,
): Promise<BalanceAndMetadataResponse | null> {
  const checkpointRes = await graphqlClient.query<LatestCheckpointResponse>({
    query: LATEST_CHECKPOINT_QUERY,
    variables: {},
  })

  if (checkpointRes.errors?.length) {
    log.error('LatestCheckpoint GraphQL query returned errors', {
      errors: checkpointRes.errors,
    })
  }

  const atCheckpoint = resolveSafeCheckpoint(
    checkpointRes.data?.checkpoint?.sequenceNumber,
  )
  const result = await graphqlClient.query<BalanceAndMetadataResponse>({
    query: BALANCE_AND_METADATA_QUERY,
    variables: { address, coinType, atCheckpoint },
  })

  if (result.errors?.length) {
    const message = result.errors.map((error) => error.message).join(', ')
    throw new Error(`GraphQL balance query failed: ${message}`)
  }

  return result.data ?? null
}

async function fetchLocalnetBalanceViaGrpc(
  localnetUrl: string,
  address: string,
  coinType: string,
): Promise<CoinBalanceResult> {
  const client = createSuiClient(SUI_LOCALNET_CHAIN, localnetUrl)
  const result = await client.getBalance({ owner: address, coinType })
  const totalBalance = result.balance?.balance ?? '0'
  const isSui = isSuiCoinType(coinType)
  const metadata = isSui ? DEFAULT_SUI_METADATA : null

  if (!isSui) {
    log.warn(
      'fetchLocalnetBalanceViaGrpc: no metadata for coin type, defaulting to 9 decimals',
      { coinType },
    )
  }

  return {
    rawBalance: totalBalance,
    formattedBalance: isSui
      ? formatMistToSui(totalBalance)
      : formatByDecimals(totalBalance, 9),
    metadata,
    coinType,
  }
}

/** The "outside consistent range" error occurs when the checkpoint advances between the two queries; retrying without `atCheckpoint` resolves it. */
const fetchZkLoginBalanceWithCheckpointRetry = async (
  graphqlClient: GraphQLClient,
  activeAddress: string,
  coinType: string,
): Promise<BalanceAndMetadataResponse | null> => {
  try {
    return await fetchZkLoginBalanceViaGraphql(
      graphqlClient,
      activeAddress,
      coinType,
    )
  } catch (err) {
    if (isOutsideConsistentRangeError(err)) {
      return fetchZkLoginBalanceViaGraphql(
        graphqlClient,
        activeAddress,
        coinType,
      )
    }
    throw err
  }
}

/** Checkpoint sequence numbers can exceed `Number.MAX_SAFE_INTEGER` on long-lived networks; querying without `atCheckpoint` is safer than passing a corrupted value. */
const resolveSafeCheckpoint = (
  raw: string | number | null | undefined,
): number | undefined => {
  const parsed =
    raw != null ? (typeof raw === 'number' ? raw : Number(raw)) : undefined
  const isSafeCheckpoint =
    parsed != null && !Number.isNaN(parsed) && Number.isSafeInteger(parsed)

  if (isSafeCheckpoint) {
    return parsed
  }

  if (raw != null) {
    log.debug(
      'Checkpoint sequenceNumber out of safe integer range or invalid, querying balance without atCheckpoint',
      { raw },
    )
  } else {
    log.debug(
      'Latest checkpoint unavailable, querying balance without atCheckpoint',
    )
  }
  return undefined
}

const isOutsideConsistentRangeError = (err: unknown): boolean => {
  const message = err instanceof Error ? err.message : String(err)
  return message.toLowerCase().includes('outside consistent range')
}

const buildGraphqlBalanceResult = (
  data: BalanceAndMetadataResponse | null,
  coinType: string,
): CoinBalanceResult => {
  const totalBalance = String(data?.address?.balance?.totalBalance ?? '0')
  const metadata = resolveBalanceMetadata(data?.coinMetadata, coinType)

  return {
    rawBalance: totalBalance,
    formattedBalance: formatBalance(totalBalance, coinType, metadata),
    metadata,
    coinType,
  }
}

const resolveBalanceMetadata = (
  meta: BalanceAndMetadataResponse['coinMetadata'] | undefined,
  coinType: string,
): BalanceMetadata | null => {
  if (isSuiCoinType(coinType)) {
    return DEFAULT_SUI_METADATA
  }
  if (isEveCoinType(coinType)) {
    return DEFAULT_EVE_TESTNET_METADATA
  }
  if (!meta || meta.decimals == null || meta.symbol == null) {
    return null
  }

  return {
    decimals: meta.decimals,
    symbol: meta.symbol,
    name: meta.name ?? '',
    description: meta.description ?? null,
    iconUrl: meta.iconUrl ?? null,
  }
}

const formatBalance = (
  totalBalance: string,
  coinType: string,
  metadata: BalanceMetadata | null,
): string => {
  if (isSuiCoinType(coinType)) {
    return formatMistToSui(totalBalance)
  }
  return metadata?.decimals === undefined
    ? totalBalance
    : formatByDecimals(totalBalance, metadata.decimals)
}
