import { normalizeStructTag } from '@mysten/sui/utils'
import { SUI_COIN_TYPE } from './constants'

/**
 * Compares two coin types structurally, so the short form (`0x2::sui::SUI`)
 * and the long form (`0x000…002::sui::SUI`, as returned by GraphQL and many
 * dapps) are treated as the same coin.
 *
 * Falls back to exact string comparison when a value is not a parseable
 * struct tag.
 */
export function isSameCoinType(a: string, b: string): boolean {
  if (a === b) return true
  try {
    return normalizeStructTag(a) === normalizeStructTag(b)
  } catch {
    return false
  }
}

/** True when `coinType` denotes native SUI, in any address form. */
export function isSuiCoinType(coinType: string): boolean {
  return isSameCoinType(coinType, SUI_COIN_TYPE)
}
