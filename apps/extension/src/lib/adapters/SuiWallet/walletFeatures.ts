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
 * Reports the Eve Vault build to dApps so they can detect outdated installs and
 * disambiguate which client is connected (e.g. from zkSigner, or a Firefox vs
 * Chrome build).
 */
export const EVEFRONTIER_VAULT_VERSION = 'evefrontier:vaultVersion' as const

export type EveVaultWalletFeaturesWithVersion = EveVaultWalletFeatures & {
  [EVEFRONTIER_VAULT_VERSION]: {
    version: '1.0.0'
    vaultVersion: string
    commit: string // Short commit SHA of the build, e.g. "18ba780e" ("unknown" if unavailable).
    platform: string // Build target the extension was compiled for, e.g. "chrome" | "firefox".
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
