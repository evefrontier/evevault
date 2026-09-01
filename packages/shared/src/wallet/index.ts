// Re-export types from types/wallet.ts for convenience
// (canonical export is from @evevault/shared/types)

export {
  ADDRESS_ALIAS_MODULE,
  type AddressAliasesInfo,
} from '@evefrontier/wallet-core/address-alias'
export {
  classifyBuildFailure,
  type ObjectChangeKind,
  type SimulatedBalanceChange,
  type SimulatedEvent,
  type SimulatedGas,
  type SimulatedObjectChange,
  simulateTransactionOutcome,
  type TransactionSimulation,
} from '@evefrontier/wallet-core/transaction'
export {
  createWebCryptoPlaceholder,
  isWebCryptoMarker,
} from '../types/wallet'
export {
  assertAliasEnforced,
  isAliasEnforcementError,
  isEnforcementOverridden,
  resolveAliasEnforcementStatus,
} from './aliasEnforcement'
export { useActiveSuiAddress } from './hooks/useActiveSuiAddress'
export { useAddressAliases } from './hooks/useAddressAliases'
export { useAliasProvisioning } from './hooks/useAliasProvisioning'
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
export {
  fetchCoinMetadata,
  invalidateCoinMetadataCache,
} from './utils/coinMetadata'
export {
  isZkLoginEpochExpiredError,
  withZkLoginEpochRetry,
} from './zkEpochRetry'
export { fetchZkProof } from './zkProof'
export { zkSignAny } from './zkSignAny'
