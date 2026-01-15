import { SUI_COIN_TYPE } from "../../utils";
import { createLogger } from "../../utils/logger";
import type { CacheEntry } from "../types/hooks";

const log = createLogger();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes cache expiry

const coinMetadataCache = new Map<string, CacheEntry>();

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
 * Fetches coin metadata for a given coin type
 */
export async function fetchCoinMetadata(
  suiClient: ReturnType<typeof import("../../sui").createSuiClient>,
  coinType: string,
): Promise<{ decimals: number; symbol: string } | null> {
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
      const metadata = { decimals: 9, symbol: "SUI" };
      coinMetadataCache.set(coinType, {
        data: metadata,
        timestamp: Date.now(),
      });
      return metadata;
    }

    // Fetch metadata for other coins
    const metadata = await suiClient.getCoinMetadata({ coinType });

    if (!metadata) {
      log.warn("No metadata found for coin type", { coinType });
      return null;
    }

    const result = {
      decimals: metadata.decimals,
      symbol: metadata.symbol,
    };

    // Cache the result with timestamp
    coinMetadataCache.set(coinType, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    log.error("Failed to fetch coin metadata", { coinType, error });
    return null;
  }
}
