import type { JwtResponse } from "@evevault/shared/types/authTypes";
import type {
  StandardEventsOnMethod,
  SuiSignAndExecuteTransactionOutput,
  SuiWalletFeatures,
} from "@mysten/wallet-standard";

export type WalletActionMessage = BackgroundMessage & {
  id?: string;
  action: string;
  [key: string]: unknown;
};

export type VaultMessage = BackgroundMessage;

export type BackgroundMessage = {
  id?: string;
  action?: string;
  type?: string;
  event?: string;
  payload?: unknown;
  [key: string]: unknown;
};

export type EveFrontierSponsoredTransactionMessage = BackgroundMessage & {
  message: {
    action: string;
    assembly: string;
    assemblyType: string;
    metadata?: SponsoredTransactionMetadata;
  };
};

export type MessageWithId = BackgroundMessage & {
  id?: string;
};

export type WebUnlockMessage = MessageWithId & {
  /** JWT response from OAuth/OIDC provider */
  jwt: JwtResponse;
  tabId?: number;
};

export type WalletEventListener = Parameters<StandardEventsOnMethod>[1];

export type SignAndExecuteTransactionMessage =
  | {
      type: "sign_and_execute_transaction_success";
      result: SuiSignAndExecuteTransactionOutput;
    }
  | {
      type: "sign_and_execute_transaction_error";
      error: string;
    };

/* EveFrontierSponsoredTransactions custom types */

export const EVEFRONTIER_SPONSORED_TRANSACTION =
  "evefrontier:sponsoredTransaction" as const;

export type EveFrontierSponsoredTransactionInput = {
  txAction: string;
  assembly: string;
  assemblyType: string;
  metadata?: SponsoredTransactionMetadata;
};

export type EveFrontierSponsoredTransactionOutput = {
  digest: string;
  effects: string;
};

export type EveFrontierSponsoredTransactionMethod = (
  input: EveFrontierSponsoredTransactionInput,
) => Promise<EveFrontierSponsoredTransactionOutput>;

export type EveVaultWalletFeatures = SuiWalletFeatures & {
  [EVEFRONTIER_SPONSORED_TRANSACTION]: {
    version: "1.0.1";
    signSponsoredTransaction: EveFrontierSponsoredTransactionMethod;
  };
};

export type SponsoredTxReturn = {
  bcsDataB64Bytes: string;
  preparationId: string;
};

//** This should be replaced by @evefrontier/dapp-kit@v0.1.4 after it is published */
export interface SponsoredTransactionMetadata {
  name?: string;
  description?: string;
  url?: string;
}
