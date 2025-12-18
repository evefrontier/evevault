export enum WalletActions {
  SIGN_PERSONAL_MESSAGE = "sign_personal_message",
  SIGN_TRANSACTION = "sign_transaction",
  SIGN_AND_EXECUTE_TRANSACTION = "sign_and_execute_transaction",
}

import type { SuiChain } from "@mysten/wallet-standard";

export interface PendingTransaction extends VaultMessage {
  transaction?: string;
  chain: SuiChain;
  account: { address: string };
}

export interface PendingPersonalMessage extends VaultMessage {
  message: string;
}

interface VaultMessage {
  id: string;
  action: WalletActions;
  senderTabId: number;
  timestamp: number;
  windowId: number;
  __to: "Eve Vault";
}
