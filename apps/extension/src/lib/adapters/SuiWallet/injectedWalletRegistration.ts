import { createLogger } from '@evevault/shared/utils'
import {
  type IdentifierRecord,
  type ReadonlyWalletAccount,
  registerWallet,
  type SuiChain,
} from '@mysten/wallet-standard'
import { EveVaultWallet } from './index'

type EveVaultRegistrationWindow = Window & {
  __evevault_registered__?: boolean
}

type WalletChangePayload = {
  chains?: SuiChain[]
  accounts?: ReadonlyWalletAccount[]
  features?: IdentifierRecord<unknown>
}

const WALLET_REGISTRATION_KEY = '__evevault_registered__'
const log = createLogger()

/**
 * Registers exactly one wallet instance on the page so repeated content-script
 * injection does not create duplicate Wallet Standard providers.
 */
export function registerInjectedWallet() {
  const reg = window as EveVaultRegistrationWindow
  if (reg[WALLET_REGISTRATION_KEY]) {
    log.info('Eve Vault already registered, skipping')
    return
  }

  try {
    const walletInstance = new EveVaultWallet()
    registerWallet(walletInstance)
    reg[WALLET_REGISTRATION_KEY] = true
    log.info('Eve Vault registered successfully')
    window.addEventListener('message', onWalletMessage(walletInstance))
    requestPersistedChain()
  } catch (error) {
    log.error('Failed to register wallet', error)
  }
}

/**
 * Applies only the wallet-standard fields included in a change payload because
 * chain, account, and feature changes are emitted independently by the
 * extension.
 */
function applyWalletChange(
  walletInstance: EveVaultWallet,
  { chains, accounts, features }: WalletChangePayload,
) {
  const [chain] = chains ?? []
  if (chain) walletInstance.setChain(chain)
  if (accounts?.length === 0) walletInstance.disconnect()
  if (features) walletInstance.setFeatures(features)
}

/**
 * Filters page messages by source and event marker before touching wallet
 * state, keeping unrelated window.postMessage traffic from dApps ignored.
 */
function onWalletMessage(walletInstance: EveVaultWallet) {
  return (event: MessageEvent) => {
    if (event.source !== window) return

    const data: Record<string, unknown> = event.data || {}
    if (data.__from !== 'Eve Vault' || data.event !== 'change') return

    applyWalletChange(
      walletInstance,
      (data.payload || {}) as WalletChangePayload,
    )
  }
}

/**
 * Requests the persisted chain immediately after registration so dApps that
 * connect early see the same chain as the extension UI.
 */
function requestPersistedChain() {
  window.postMessage({ __to: 'Eve Vault', type: 'get_current_chain' }, '*')
}
