import { parseStructTag } from '@mysten/sui/utils'

/**
 * Extracts the symbol from a coin type string
 * Uses Mysten Labs parseStructTag for proper parsing
 * e.g., "0x2::sui::SUI" -> "SUI"
 */
export function extractSymbolFromCoinType(coinType: string): string {
  try {
    const struct = parseStructTag(coinType)
    return struct.name || coinType
  } catch {
    // Fallback to simple parsing if parseStructTag fails
    const parts = coinType.split('::')
    return parts[parts.length - 1] || coinType
  }
}
