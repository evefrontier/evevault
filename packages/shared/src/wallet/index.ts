// Re-export types from types/wallet.ts for convenience
// (canonical export is from @evevault/shared/types)

export {
  createWebCryptoPlaceholder,
  isWebCryptoMarker,
} from '../types/wallet'
export { useActiveSuiAddress } from './hooks/useActiveSuiAddress'
export { useAddressAliases } from './hooks/useAddressAliases'
export type { AddressAliasesInfo } from './hooks/useAddressAliases.config'
export { useBalance } from './hooks/useBalance'
export { useSendToken } from './hooks/useSendToken'
export { useTransactionHistory } from './hooks/useTransactionHistory'
export { useWalletSigningContext } from './hooks/useWalletSigningContext'
export { signForChain } from './signForChain'
export type {
  CoinMetadataQueryResponse,
  CoinMetadataResult,
} from './types/coinMetadata'
export type { BalanceAndMetadataResponse } from './types/graphql'
export { invalidateCoinMetadataCache } from './utils/coinMetadata'
export { fetchZkProof } from './zkProof'
export { zkSignAny } from './zkSignAny'
