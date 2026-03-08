// Re-export types from types/wallet.ts for convenience
// (canonical export is from @evevault/shared/types)
export * from "../types";
export {
  createWebCryptoPlaceholder,
  WEB_CRYPTO_PLACEHOLDER_DATA,
  WEB_CRYPTO_PLACEHOLDER_IV,
} from "../types/wallet";
export { ephSign } from "./ephSign";
export { useBalance } from "./hooks/useBalance";
export { useSendToken } from "./hooks/useSendToken";
export { useTransactionHistory } from "./hooks/useTransactionHistory";
export { invalidateCoinMetadataCache } from "./utils/coinMetadata";
export { fetchZkProof } from "./zkProof";
export { zkSignAny } from "./zkSignAny";
