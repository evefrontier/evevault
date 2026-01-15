import { parseStructTag } from "@mysten/sui/utils";
import { SUI_COIN_TYPE } from "../../utils";
import { formatByDecimals } from "../../utils/format";
import { createLogger } from "../../utils/logger";
import { fetchCoinMetadata } from "./coinMetadata";

const log = createLogger();

/**
 * Extracts the symbol from a coin type string
 * Uses Mysten Labs parseStructTag for proper parsing
 * e.g., "0x2::sui::SUI" -> "SUI"
 */
export function extractSymbolFromCoinType(coinType: string): string {
  try {
    const struct = parseStructTag(coinType);
    return struct.name || coinType;
  } catch {
    // Fallback to simple parsing if parseStructTag fails
    const parts = coinType.split("::");
    return parts[parts.length - 1] || coinType;
  }
}

/**
 * Formats transaction amount based on coin type using metadata
 */
export async function formatTransactionAmount(
  rawAmount: string,
  coinType: string,
  suiClient: ReturnType<typeof import("../../sui").createSuiClient>,
): Promise<string> {
  const metadata = await fetchCoinMetadata(suiClient, coinType);
  let decimals: number;

  if (metadata) {
    decimals = metadata.decimals;
  } else {
    // Fallback to 9 decimals (SUI default) if metadata is unavailable.
    // This may be incorrect for non-SUI tokens, so we log a warning for observability.
    decimals = 9;
    log.warn("Falling back to default decimals for coin type", {
      coinType,
      rawAmount,
      defaultDecimals: decimals,
    });
  }

  return formatByDecimals(rawAmount, decimals);
}
