import { EVEFRONTIER_SPONSORED_TRANSACTION } from '@evefrontier/wallet-core/wallet-standard-extensions'
import {
  StandardConnect,
  StandardDisconnect,
  SuiSignAndExecuteTransaction,
  SuiSignPersonalMessage,
  SuiSignTransaction,
} from '@mysten/wallet-standard'

export const WALLET_FEATURES = [
  StandardConnect,
  StandardDisconnect,
  SuiSignPersonalMessage,
  SuiSignTransaction,
  SuiSignAndExecuteTransaction,
  EVEFRONTIER_SPONSORED_TRANSACTION,
] as const
