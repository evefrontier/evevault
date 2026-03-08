import { EVE_TESTNET_COIN_TYPE, SUI_COIN_TYPE } from "../../utils";
import type { BalanceMetadata } from "../types/hooks";

export const DEFAULT_SUI_METADATA: BalanceMetadata = {
  decimals: 9,
  symbol: "SUI",
  name: "Sui",
  description: "Sui Native Token",
  iconUrl: null,
};

export const DEFAULT_EVE_TESTNET_METADATA: BalanceMetadata = {
  decimals: 9,
  symbol: "EVE",
  name: "EVE test token",
  description: "EVE test token on testnet",
  iconUrl: null,
};

/** Display name and symbol for known coin types when balance/metadata is not yet loaded (e.g. before query runs or on web before rehydration). */
export function getKnownTokenDisplay(coinType: string): {
  name: string;
  symbol: string;
} | null {
  if (coinType === SUI_COIN_TYPE) {
    return {
      name: DEFAULT_SUI_METADATA.name,
      symbol: DEFAULT_SUI_METADATA.symbol,
    };
  }
  if (coinType === EVE_TESTNET_COIN_TYPE) {
    return {
      name: DEFAULT_EVE_TESTNET_METADATA.name,
      symbol: DEFAULT_EVE_TESTNET_METADATA.symbol,
    };
  }
  return null;
}
