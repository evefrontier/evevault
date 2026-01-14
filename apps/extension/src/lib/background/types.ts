import type { JwtResponse } from "@evevault/shared/types/authTypes";
import type { Transaction } from "@mysten/sui/transactions";
import type {
  StandardEventsOnMethod,
  SuiSignAndExecuteTransactionInput,
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
  transaction: Transaction;
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
    version: "1.0.0";
    signSponsoredTransaction: EveFrontierSponsoredTransactionMethod;
  };
};
