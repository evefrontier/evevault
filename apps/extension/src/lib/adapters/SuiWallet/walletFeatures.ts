import {
  EVEFRONTIER_SPONSORED_TRANSACTION,
  type EveVaultWalletFeatures,
} from '@evefrontier/wallet-core/wallet-features'
import {
  StandardConnect,
  StandardDisconnect,
  SuiSignAndExecuteTransaction,
  SuiSignPersonalMessage,
  SuiSignTransaction,
} from '@mysten/wallet-standard'

/**
 * Reports the Eve Vault extension's package version to dApps so they can detect
 * outdated installs. Distinct from the Wallet Standard `version` ('1.0.0'),
 * which identifies the spec the wallet implements, not the client build.
 */
export const EVEFRONTIER_VAULT_VERSION = 'evefrontier:vaultVersion' as const

export type EveVaultWalletFeaturesWithVersion = EveVaultWalletFeatures & {
  [EVEFRONTIER_VAULT_VERSION]: {
    version: '1.0.0'
    vaultVersion: string
  }
}

export const WALLET_FEATURES = [
  StandardConnect,
  StandardDisconnect,
  SuiSignPersonalMessage,
  SuiSignTransaction,
  SuiSignAndExecuteTransaction,
  EVEFRONTIER_SPONSORED_TRANSACTION,
  EVEFRONTIER_VAULT_VERSION,
] as const
