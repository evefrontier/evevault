import type { SuiGraphQLClient } from '@mysten/sui/graphql'
import { SUI_COIN_TYPE } from '#/utils'
import { createLogger } from '#/utils/logger'
import type {
  CoinMetadataQueryResponse,
  CoinMetadataResult,
} from '#/wallet/types/coinMetadata'
import type { CacheEntry } from '#/wallet/types/hooks'

const log = createLogger()
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes cache expiry

const coinMetadataCache = new Map<string, CacheEntry<CoinMetadataResult>>()

const COIN_METADATA_QUERY = `
  query CoinMetadata($coinType: String!) {
    coinMetadata(coinType: $coinType) {
      decimals
      name
      symbol
      description
      iconUrl
    }
  }
`

/**
 * Manually invalidate cache for a specific coin type or clear entire cache
 */
export function invalidateCoinMetadataCache(coinType?: string): void {
  if (coinType) {
    coinMetadataCache.delete(coinType)
  } else {
    coinMetadataCache.clear()
  }
}

/**
 * Fetches coin metadata for a given coin type via Sui GraphQL RPC (Beta).
 */
export async function fetchCoinMetadata(
  graphqlClient: SuiGraphQLClient,
  coinType: string,
): Promise<CoinMetadataResult | null> {
  try {
    const metadata =
      getCachedCoinMetadata(coinType) ??
      getKnownCoinMetadata(coinType) ??
      (await queryCoinMetadata(graphqlClient, coinType))

    cacheCoinMetadata(coinType, metadata)
    return metadata
  } catch (error) {
    log.error('Failed to fetch coin metadata', { coinType, error })
    return null
  }
}

const getCachedCoinMetadata = (coinType: string): CoinMetadataResult | null => {
  const cached = coinMetadataCache.get(coinType)
  const isFresh = cached && Date.now() - cached.timestamp < CACHE_TTL_MS

  if (!cached) {
    return null
  }

  if (!isFresh) {
    coinMetadataCache.delete(coinType)
    return null
  }

  return cached.data as CoinMetadataResult
}

const getKnownCoinMetadata = (coinType: string): CoinMetadataResult | null => {
  return coinType === SUI_COIN_TYPE
    ? {
        decimals: 9,
        symbol: 'SUI',
        name: 'Sui',
        description: 'Sui Native Token',
        iconUrl: null,
      }
    : null
}

const queryCoinMetadata = async (
  graphqlClient: SuiGraphQLClient,
  coinType: string,
): Promise<CoinMetadataResult | null> => {
  const result = await graphqlClient.query<CoinMetadataQueryResponse>({
    query: COIN_METADATA_QUERY,
    variables: { coinType },
  })

  if (result.errors?.length) {
    log.warn('GraphQL coinMetadata errors', {
      coinType,
      errors: result.errors.map((e) => e.message),
    })
    return null
  }

  return normalizeCoinMetadataNode(result.data?.coinMetadata, coinType)
}

const normalizeCoinMetadataNode = (
  node: CoinMetadataQueryResponse['coinMetadata'] | undefined,
  coinType: string,
): CoinMetadataResult | null => {
  if (!node || node.decimals == null || node.symbol == null) {
    log.warn('No metadata found for coin type', { coinType })
    return null
  }

  return {
    decimals: node.decimals,
    symbol: node.symbol,
    name: node.name ?? undefined,
    description: node.description ?? undefined,
    iconUrl: node.iconUrl ?? undefined,
  }
}

const cacheCoinMetadata = (
  coinType: string,
  metadata: CoinMetadataResult | null,
) => {
  if (metadata) {
    coinMetadataCache.set(coinType, { data: metadata, timestamp: Date.now() })
  }
}
