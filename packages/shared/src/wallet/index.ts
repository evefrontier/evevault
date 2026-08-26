// Re-export types from types/wallet.ts for convenience
// (canonical export is from @evevault/shared/types)

export {
  ADDRESS_ALIAS_MODULE,
  type AddressAliasesInfo,
} from '@evefrontier/wallet-core/address-alias'
export {
  createWebCryptoPlaceholder,
  isWebCryptoMarker,
} from '../types/wallet'
export { useActiveSuiAddress } from './hooks/useActiveSuiAddress'
export { useAddressAliases } from './hooks/useAddressAliases'
export { useBalance } from './hooks/useBalance'
export { useSendToken } from './hooks/useSendToken'
export { useTransactionHistory } from './hooks/useTransactionHistory'
export { useWalletSigningContext } from './hooks/useWalletSigningContext'
export {
  signAndExecuteTransaction,
  TransactionFailedError,
} from './signAndExecute'
export { signForChain } from './signForChain'
export type {
  CoinMetadataQueryResponse,
  CoinMetadataResult,
} from './types/coinMetadata'
export type { BalanceAndMetadataResponse } from './types/graphql'
export { invalidateCoinMetadataCache } from './utils/coinMetadata'
export {
  classifyBuildFailure,
  type ObjectChangeKind,
  type SimulatedBalanceChange,
  type SimulatedEvent,
  type SimulatedGas,
  type SimulatedObjectChange,
  simulateTransactionOutcome,
  type TransactionSimulation,
} from './utils/simulateTransaction'
export {
  isZkLoginEpochExpiredError,
  withZkLoginEpochRetry,
} from './zkEpochRetry'
export { fetchZkProof } from './zkProof'
export { zkSignAny } from './zkSignAny'
