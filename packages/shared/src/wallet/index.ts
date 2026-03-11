// Re-export types from types/wallet.ts for convenience
// (canonical export is from @evevault/shared/types)

export {
  createWebCryptoPlaceholder,
  WEB_CRYPTO_PLACEHOLDER_DATA,
  WEB_CRYPTO_PLACEHOLDER_IV,
} from "../types/wallet";
export { ephSign } from "./ephSign";
export { getEveCoinType, isEveCoinType } from "./eveToken";
export { useBalance } from "./hooks/useBalance";
export { useSendToken } from "./hooks/useSendToken";
export { useTransactionHistory } from "./hooks/useTransactionHistory";
export type {
  CoinMetadataQueryResponse,
  CoinMetadataResult,
} from "./types/coinMetadata";
export type { BalanceAndMetadataResponse } from "./types/graphql";
export { invalidateCoinMetadataCache } from "./utils/coinMetadata";
export { fetchZkProof } from "./zkProof";
export { zkSignAny } from "./zkSignAny";
