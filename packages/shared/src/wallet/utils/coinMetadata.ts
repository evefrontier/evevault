import type { SuiGraphQLClient } from "@mysten/sui/graphql";
import { SUI_COIN_TYPE } from "../../utils";
import { createLogger } from "../../utils/logger";
import type {
  CoinMetadataQueryResponse,
  CoinMetadataResult,
} from "../types/coinMetadata";
import type { CacheEntry } from "../types/hooks";

const log = createLogger();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes cache expiry

const coinMetadataCache = new Map<string, CacheEntry<CoinMetadataResult>>();

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
`;

/**
 * Manually invalidate cache for a specific coin type or clear entire cache
 */
export function invalidateCoinMetadataCache(coinType?: string): void {
  if (coinType) {
    coinMetadataCache.delete(coinType);
  } else {
    coinMetadataCache.clear();
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
    // Check cache first with expiry
    const cached = coinMetadataCache.get(coinType);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    // Remove expired entry if it exists
    if (cached) {
      coinMetadataCache.delete(coinType);
    }

    // For SUI, we know the metadata
    if (coinType === SUI_COIN_TYPE) {
      const metadata: CoinMetadataResult = {
        decimals: 9,
        symbol: "SUI",
        name: "Sui",
        description: "Sui Native Token",
        iconUrl: null,
      };
      coinMetadataCache.set(coinType, {
        data: metadata,
        timestamp: Date.now(),
      });
      return metadata;
    }

    const result = await graphqlClient.query<CoinMetadataQueryResponse>({
      query: COIN_METADATA_QUERY,
      variables: { coinType },
    });

    if (result.errors?.length) {
      log.warn("GraphQL coinMetadata errors", {
        coinType,
        errors: result.errors.map((e) => e.message),
      });
      return null;
    }

    const node = result.data?.coinMetadata;
    if (!node || node.decimals == null || node.symbol == null) {
      log.warn("No metadata found for coin type", { coinType });
      return null;
    }

    const meta: CoinMetadataResult = {
      decimals: node.decimals,
      symbol: node.symbol,
      name: node.name ?? undefined,
      description: node.description ?? undefined,
      iconUrl: node.iconUrl ?? undefined,
    };

    coinMetadataCache.set(coinType, { data: meta, timestamp: Date.now() });
    return meta;
  } catch (error) {
    log.error("Failed to fetch coin metadata", { coinType, error });
    return null;
  }
}
