import type { SuiChain } from '@mysten/wallet-standard'

export enum WalletActions {
  SIGN_PERSONAL_MESSAGE = 'sign_personal_message',
  SIGN_TRANSACTION = 'sign_transaction',
  SIGN_AND_EXECUTE_TRANSACTION = 'sign_and_execute_transaction',
  SIGN_SPONSORED_TRANSACTION = 'sign_sponsored_transaction',
}

export interface DappRequestContext {
  origin: string
  url?: string
  title?: string
  favIconUrl?: string
  connectedAt?: number
}

export interface PendingTransaction extends VaultMessage {
  transaction: string
  chain: SuiChain
  account: { address: string }
}

export interface ParsedTransactionWithDisplay extends PendingTransaction {
  displayValue: string
}

export interface PendingPersonalMessage extends VaultMessage {
  /** Raw bytes of the message as sent by the dapp (Uint8Array serialized through chrome storage) */
  message: Uint8Array | Record<string, number> | number[]
  account?: { address: string }
}

export type PendingSponsoredTransactionMetadata = {
  name?: string
  description?: string
  url?: string
}

export interface PendingSponsoredTransaction {
  action: WalletActions.SIGN_SPONSORED_TRANSACTION
  id?: string
  senderTabId?: number
  timestamp: number
  windowId: number
  sponsoredTxB64: string
  preparationId: string
  chain: SuiChain
  dapp?: DappRequestContext
  sponsoredAction?: string
  /** Numeric `assemblyId`; mirrors EveFrontierSponsoredTransactionMessage.assembly. */
  assembly?: number
  assemblyType?: string
  metadata?: PendingSponsoredTransactionMetadata
}

export type PendingAction =
  | PendingTransaction
  | PendingPersonalMessage
  | PendingSponsoredTransaction

export interface VaultMessage {
  id: string
  action: WalletActions
  senderTabId: number
  timestamp: number
  windowId: number
  __to: 'Eve Vault'
  dapp?: DappRequestContext
}
