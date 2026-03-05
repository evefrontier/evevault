/**
 * Accept 0x...::module::COIN or 0x2::Coin<0x...::module::COIN>
 */
const SIMPLE_COIN_TYPE_FORMAT = /^0x[a-fA-F0-9]+::\w+::\w+$/;
const GENERIC_COIN_FORMAT = /^0x2::Coin<0x[a-fA-F0-9]+::[^>]+>$/;

export function isValidCoinTypeFormat(value: string): boolean {
  return SIMPLE_COIN_TYPE_FORMAT.test(value) || GENERIC_COIN_FORMAT.test(value);
}
