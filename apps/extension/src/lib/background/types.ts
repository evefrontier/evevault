import type { SponsoredTransactionMetadata } from '@evefrontier/wallet-core/wallet-standard-extensions'
import type { OAuthTokenResponse } from '@evevault/shared/types'
import type {
  StandardEventsOnMethod,
  SuiSignAndExecuteTransactionOutput,
} from '@mysten/wallet-standard'

export type WalletActionMessage = BackgroundMessage & {
  id?: string
  action: string
  [key: string]: unknown
}

export type VaultMessage = BackgroundMessage

export type BackgroundMessage = {
  id?: string
  action?: string
  type?: string
  event?: string
  payload?: unknown
  [key: string]: unknown
}

export type EveFrontierSponsoredTransactionMessage = BackgroundMessage & {
  message: {
    action: string
    assembly: string
    assemblyType: string
    metadata?: SponsoredTransactionMetadata
  }
}

export type MessageWithId = BackgroundMessage & {
  id?: string
}

export type WebUnlockMessage = MessageWithId & {
  /** JWT response from OAuth/OIDC provider */
  jwt: OAuthTokenResponse
  tabId?: number
}

export type WalletEventListener = Parameters<StandardEventsOnMethod>[1]

export type SignAndExecuteTransactionMessage =
  | {
      type: 'sign_and_execute_transaction_success'
      result: SuiSignAndExecuteTransactionOutput
    }
  | {
      type: 'sign_and_execute_transaction_error'
      error: string
    }

/* EveFrontierSponsoredTransactions custom types */

export type SponsoredTxReturn = {
  bcsDataB64Bytes: string
  preparationId: string
}
