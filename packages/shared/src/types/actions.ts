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
  reviewValue?: unknown
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
  /**
   * Per-approval id minted by the background when the popup is opened. The popup
   * echoes it back in transactionResult so the background can settle only the
   * request the result actually belongs to. Required: a result with no matching
   * requestId is dropped, so an unstamped request can never settle.
   */
  requestId: string
  sponsoredTxB64: string
  preparationId: string
  chain: SuiChain
  dapp?: DappRequestContext
  sponsoredAction?: string
  assembly?: string
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
  /**
   * Per-approval id minted by the background when the popup is opened. The popup
   * echoes it back in transactionResult so the background can bind the result to
   * this specific request (not just a reused windowId). Required: a result with
   * no matching requestId is dropped, so an unstamped request can never settle.
   */
  requestId: string
  __to: 'Eve Vault'
  dapp?: DappRequestContext
}
