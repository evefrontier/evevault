import { createLogger } from '@evevault/shared/utils'
import {
  type IdentifierRecord,
  type ReadonlyWalletAccount,
  registerWallet,
  type SuiChain,
} from '@mysten/wallet-standard'
import { EveVaultWallet } from './index'

const WALLET_REGISTRATION_KEY = '__evevault_registered__'

type EveVaultRegistrationWindow = Window & {
  [WALLET_REGISTRATION_KEY]?: boolean
}

type WalletChangePayload = {
  chains?: SuiChain[]
  accounts?: ReadonlyWalletAccount[]
  features?: IdentifierRecord<unknown>
}

const log = createLogger()

function applyWalletChange(
  walletInstance: EveVaultWallet,
  { chains, accounts, features }: WalletChangePayload,
) {
  const [chain] = chains ?? []
  if (chain) walletInstance.setChain(chain)
  if (accounts?.length === 0) walletInstance.disconnect()
  if (features) walletInstance.setFeatures(features)
}

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

function requestPersistedChain() {
  window.postMessage({ __to: 'Eve Vault', type: 'get_current_chain' }, '*')
}

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
