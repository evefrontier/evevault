// Re-export types from types/wallet.ts for convenience
// (canonical export is from @evevault/shared/types)
export type {
  EphSignParams,
  ZkProofParams,
  ZkSignAnyParams,
} from "../types/wallet";
export {
  createWebCryptoPlaceholder,
  WEB_CRYPTO_PLACEHOLDER_DATA,
  WEB_CRYPTO_PLACEHOLDER_IV,
} from "../types/wallet";
export { ephSign } from "./ephSign";
export { useBalance } from "./hooks/useBalance";
export { fetchZkProof } from "./zkProof";
export { zkSignAny } from "./zkSignAny";
