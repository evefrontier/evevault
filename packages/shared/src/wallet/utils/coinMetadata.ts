import {
  CachedCoinMetadataResolver,
  type ResolvedCoinMetadata,
} from '@evefrontier/wallet-core/transaction'
import type { SuiGraphQLClient } from '@mysten/sui/graphql'
import { createLogger } from '#/utils/logger'
import type { CoinMetadataQueryResponse } from '#/wallet/types/coinMetadata'

const log = createLogger()

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

// One resolver per GraphQL client, so each client reuses its metadata cache.
const resolvers = new Map<SuiGraphQLClient, CachedCoinMetadataResolver>()

/**
 * Builds a cached resolver backed by evevault's GraphQL metadata source. Create
 * it once per GraphQL client or wallet session; a fresh resolver starts empty.
 */
export function createGraphQLCoinMetadataResolver(
  graphqlClient: SuiGraphQLClient,
): CachedCoinMetadataResolver {
  return new CachedCoinMetadataResolver((coinType) =>
    queryCoinMetadata(graphqlClient, coinType),
  )
}

const getResolver = (
  graphqlClient: SuiGraphQLClient,
): CachedCoinMetadataResolver => {
  let resolver = resolvers.get(graphqlClient)
  if (!resolver) {
    resolver = createGraphQLCoinMetadataResolver(graphqlClient)
    resolvers.set(graphqlClient, resolver)
  }
  return resolver
}

/**
 * Manually invalidate cache for a specific coin type or clear entire cache.
 */
export function invalidateCoinMetadataCache(coinType?: string): void {
  for (const resolver of resolvers.values()) {
    resolver.clearCache(coinType)
  }
}

/**
 * Fetches coin metadata for a given coin type through the shared per-client
 * cached resolver.
 */
export async function fetchCoinMetadata(
  graphqlClient: SuiGraphQLClient,
  coinType: string,
): Promise<ResolvedCoinMetadata | null> {
  return getResolver(graphqlClient).resolve(coinType)
}

const queryCoinMetadata = async (
  graphqlClient: SuiGraphQLClient,
  coinType: string,
): Promise<ResolvedCoinMetadata | null> => {
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
): ResolvedCoinMetadata | null => {
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
