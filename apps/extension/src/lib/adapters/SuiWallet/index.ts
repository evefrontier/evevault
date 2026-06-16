import {
  EVEFRONTIER_SPONSORED_TRANSACTION,
  type EveVaultWalletFeatures,
  type SponsoredTransactionInput,
  type SponsoredTransactionMethod,
} from '@evefrontier/wallet-core/wallet-standard-extensions'
import { WalletStandardMessageTypes } from '@evevault/shared'
import { createLogger } from '@evevault/shared/utils'
import type {
  IdentifierRecord,
  StandardConnectMethod,
  StandardConnectOutput,
  StandardDisconnectMethod,
  StandardEventsOnMethod,
  SuiChain,
  SuiSignAndExecuteTransactionInput,
  SuiSignAndExecuteTransactionMethod,
  SuiSignAndExecuteTransactionOutput,
  SuiSignPersonalMessageInput,
  SuiSignPersonalMessageMethod,
  SuiSignPersonalMessageOutput,
  SuiSignTransactionInput,
  SuiSignTransactionMethod,
  Wallet,
} from '@mysten/wallet-standard'
import {
  ReadonlyWalletAccount,
  StandardConnect,
  StandardDisconnect,
  StandardEvents,
  SUI_DEVNET_CHAIN,
  SUI_TESTNET_CHAIN,
  SuiSignAndExecuteTransaction,
  SuiSignPersonalMessage,
  SuiSignTransaction,
} from '@mysten/wallet-standard'
import type { WalletEventListener } from '@/lib/background/types'
import { trySettle } from '@/lib/util/timeoutGuard'
import { postToEveVaultBridge } from './bridgeTargetOrigin'
import { getAccountsFromAuthSuccess } from './connectAuth'
import { APPROVAL_TIMEOUT_MS, waitForVaultMessage } from './vaultMessages'
import { WALLET_FEATURES } from './walletFeatures'

const log = createLogger()

export class EveVaultWallet implements Wallet {
  readonly #version = '1.0.0' as const
  readonly #name = 'Eve Vault' as const

  #accounts: ReadonlyWalletAccount[] = []
  #eventListeners = new Map<string, WalletEventListener[]>()
  #currentChain: SuiChain = SUI_TESTNET_CHAIN

  get version() {
    return this.#version
  }

  get name() {
    return this.#name
  }

  get icon(): Wallet['icon'] {
    // You can replace this with your wallet's icon data URL
    return 'data:image/png;base64,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' as `data:image/png;base64,${string}`
  }

  get chains(): Wallet['chains'] {
    return [this.#currentChain, this.#getOtherChain()] as `sui:${string}`[]
  }

  get accounts() {
    return this.#accounts.map(
      (walletAccount) =>
        new ReadonlyWalletAccount({
          address: walletAccount.address,
          publicKey: walletAccount.publicKey,
          chains: [this.#currentChain, this.#getOtherChain()],
          // The features that this account supports. This can be a subset of the wallet's supported features.
          features: [...WALLET_FEATURES],
        }),
    )
  }

  get features(): EveVaultWalletFeatures {
    return {
      [StandardConnect]: {
        version: '1.0.0',
        connect: this.#connect,
      },
      [StandardDisconnect]: {
        version: '1.0.0',
        disconnect: this.#disconnect,
      },
      [StandardEvents]: {
        version: '1.0.0',
        on: this.#on,
      },
      [SuiSignPersonalMessage]: {
        version: '1.1.0',
        signPersonalMessage: this.#signPersonalMessage,
      },
      [SuiSignTransaction]: {
        version: '2.0.0',
        signTransaction: this.#signTransaction,
      },
      [SuiSignAndExecuteTransaction]: {
        version: '2.0.0',
        signAndExecuteTransaction: this.#signAndExecuteTransaction,
      },
      [EVEFRONTIER_SPONSORED_TRANSACTION]: {
        version: '1.0.1',
        signSponsoredTransaction: this.#signEveFrontierSponsoredTransaction,
      },
    }
  }

  /**
   * Wallet Standard events subscription method
   * dApps call this via: wallet.features['standard:events'].on('change', callback)
   */
  #on: StandardEventsOnMethod = (event, listener) => {
    const list = this.#eventListeners.get(event) ?? []
    list.push(listener)
    this.#eventListeners.set(event, list)

    return () => {
      const listeners = this.#eventListeners.get(event)
      if (!listeners) return
      const index = listeners.indexOf(listener)
      if (index > -1) listeners.splice(index, 1)
    }
  }

  /**
   * Internal method to emit change events to all registered listeners
   * Called by setChain(), disconnect(), and #connect() when state changes
   *
   * Per Wallet Standard spec:
   * - accounts: All current accounts (when accounts change)
   * - chains: Changed chains (when chain changes)
   * - features: Changed features (when features change)
   */
  #emitChangeEvent(properties: {
    accounts?: ReadonlyWalletAccount[]
    chains?: SuiChain[]
    features?: Record<string, unknown>
  }) {
    const listeners = this.#eventListeners.get('change')
    if (!listeners || listeners.length === 0) return

    // Per Wallet Standard spec: accounts should be all current accounts when accounts change
    // chains should be the changed chains when chain changes
    // features should be the changed features when features change
    const event = {
      accounts: properties.accounts !== undefined ? this.accounts : [],
      chains: properties.chains || [],
      features: properties.features || {},
    }

    // Call all registered listeners with the event
    listeners.forEach((listener) => {
      try {
        listener(event)
      } catch (error) {
        log.error('Error in wallet event listener', error)
      }
    })
  }

  #getOtherChain(): SuiChain {
    return this.#currentChain === SUI_TESTNET_CHAIN
      ? SUI_DEVNET_CHAIN
      : SUI_TESTNET_CHAIN
  }

  /**
   * Update the current chain and emit a change event
   * Public method to allow external chain updates
   */
  setChain(chain: SuiChain): void {
    if (this.#currentChain !== chain) {
      this.#currentChain = chain
      this.#emitChangeEvent({ chains: [chain] })
    }
  }

  setFeatures(features: IdentifierRecord<unknown>): void {
    if (features) {
      this.#emitChangeEvent({ features: features })
    }
  }

  /**
   * Remove all accounts and emit a change event
   * Called when user disconnects or logs out
   * Empty array when disconnected
   */
  disconnect(): void {
    if (this.#accounts.length > 0) {
      this.#accounts = []
      this.#emitChangeEvent({ accounts: [] })
    }
  }

  #disconnect: StandardDisconnectMethod = async () => {
    const id = crypto.randomUUID()
    await waitForVaultMessage({
      id,
      successType: 'disconnect_success',
      errorType: 'disconnect_error',
      outbound: {
        __to: 'Eve Vault',
        id,
        type: WalletStandardMessageTypes.DISCONNECT,
      },
      mapSuccess: () => undefined,
      timeoutMessage: 'Disconnect timed out',
    })

    this.disconnect()
  }

  // Not authenticated, trigger login flow
  #connect: StandardConnectMethod = async (input) => {
    if (input?.silent && this.#accounts.length > 0) {
      return { accounts: this.accounts }
    }

    return new Promise<StandardConnectOutput>((resolve, reject) => {
      const id = crypto.randomUUID()
      const state = { settled: false }
      let timeoutId: ReturnType<typeof setTimeout> | undefined

      const onMsg = async (e: MessageEvent) => {
        const m: Record<string, unknown> = e.data || {}
        if (m.__from !== 'Eve Vault' || m.id !== id) return
        if (trySettle(state, onMsg, timeoutId)) {
          if (m.type === 'auth_success') {
            try {
              this.#accounts = await getAccountsFromAuthSuccess(m, [
                this.#currentChain,
                this.#getOtherChain(),
              ])
              this.#emitChangeEvent({ accounts: this.#accounts })
              resolve({ accounts: this.accounts })
            } catch (error) {
              reject(error)
            }
          } else {
            reject(
              new Error(
                (m.error as { message?: string })?.message ||
                  'Authentication failed',
              ),
            )
          }
        }
      }

      window.addEventListener('message', onMsg)
      timeoutId = setTimeout(() => {
        if (trySettle(state, onMsg)) {
          reject(new Error('Connection request timed out'))
        }
      }, APPROVAL_TIMEOUT_MS)
      postToEveVaultBridge({ __to: 'Eve Vault', type: 'connect', id })
    })
  }

  #signPersonalMessage: SuiSignPersonalMessageMethod = async (
    input: SuiSignPersonalMessageInput,
  ) => {
    const id = crypto.randomUUID()
    log.debug('[SuiWallet] #signPersonalMessage input', input)
    return waitForVaultMessage({
      id,
      successType: 'sign_success',
      errorType: 'sign_personal_message_error',
      outbound: {
        __to: 'Eve Vault',
        id,
        action: 'sign_personal_message',
        message: input.message,
        account: input.account,
      },
      mapSuccess: (m) =>
        ({
          bytes: m.bytes,
          signature: m.signature,
        }) as SuiSignPersonalMessageOutput,
      timeoutMessage: 'Message signing timed out',
    })
  }

  #signTransaction: SuiSignTransactionMethod = async (
    input: SuiSignTransactionInput,
  ) => {
    const tx = await input.transaction.toJSON()
    const id = crypto.randomUUID()
    log.debug('[SuiWallet] #signTransaction outbound')
    return waitForVaultMessage({
      id,
      successType: 'sign_success',
      errorType: 'sign_transaction_error',
      outbound: {
        __to: 'Eve Vault',
        id,
        action: 'sign_transaction',
        transaction: tx,
        account: input.account,
        chain: input.chain ?? this.#currentChain,
      },
      mapSuccess: (m) => ({
        bytes: m.bytes as string,
        signature: m.signature as string,
      }),
      timeoutMessage: 'Transaction signing timed out',
    })
  }

  #signAndExecuteTransaction: SuiSignAndExecuteTransactionMethod = async (
    input: SuiSignAndExecuteTransactionInput,
  ) => {
    const tx = await input.transaction.toJSON()
    const id = crypto.randomUUID()
    return waitForVaultMessage({
      id,
      successType: 'sign_and_execute_transaction_success',
      errorType: 'sign_and_execute_transaction_error',
      outbound: {
        __to: 'Eve Vault',
        id,
        action: WalletStandardMessageTypes.SIGN_AND_EXECUTE_TRANSACTION,
        transaction: tx,
        account: input.account,
        chain: input.chain ?? this.#currentChain,
      },
      mapSuccess: (m) => m.result as SuiSignAndExecuteTransactionOutput,
      timeoutMessage: 'Transaction approval timed out',
    })
  }

  #signEveFrontierSponsoredTransaction: SponsoredTransactionMethod = async (
    input: SponsoredTransactionInput,
  ) => {
    const id = crypto.randomUUID()
    log.debug('[SuiWallet] #signEveFrontierSponsoredTransaction input', input)
    const hasMetadata =
      input.metadata &&
      (input.metadata.name != null ||
        input.metadata.description != null ||
        input.metadata.url != null)
    return waitForVaultMessage({
      id,
      successType: 'sign_success',
      errorType: 'sign_sponsored_transaction_error',
      outbound: {
        __to: 'Eve Vault',
        id,
        action:
          WalletStandardMessageTypes.EVEFRONTIER_SIGN_SPONSORED_TRANSACTION,
        message: {
          action: input.txAction,
          assembly: String(input.assembly),
          assemblyType: input.assemblyType,
          ...(hasMetadata && {
            metadata: {
              name: input.metadata?.name,
              description: input.metadata?.description,
              url: input.metadata?.url,
            },
          }),
        },
      },
      mapSuccess: (m) => ({
        digest: m.digest as string,
        effects: m.effects as string,
      }),
      timeoutMessage: 'Sponsored transaction timed out',
    })
  }
}
