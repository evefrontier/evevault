import { WalletStandardMessageTypes } from "@evevault/shared";
import { getZkLoginAddress } from "@evevault/shared/auth";
import { createLogger } from "@evevault/shared/utils";
import type {
  IdentifierRecord,
  SignedTransaction,
  StandardConnectMethod,
  StandardConnectOutput,
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
} from "@mysten/wallet-standard";
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
} from "@mysten/wallet-standard";
import type {
  EveFrontierSponsoredTransactionInput,
  EveFrontierSponsoredTransactionMethod,
  EveFrontierSponsoredTransactionOutput,
  EveVaultWalletFeatures,
  SignAndExecuteTransactionMessage,
  WalletEventListener,
} from "../background/types";
import { EVEFRONTIER_SPONSORED_TRANSACTION } from "../background/types";

const log = createLogger();

const isSignAndExecuteTransactionMessage = (
  message: unknown,
): message is SignAndExecuteTransactionMessage => {
  if (typeof message !== "object" || message === null) {
    return false;
  }

  const candidate = message as { type?: unknown };
  return (
    candidate.type === "sign_and_execute_transaction_success" ||
    candidate.type === "sign_and_execute_transaction_error"
  );
};

export class EveVaultWallet implements Wallet {
  readonly #version = "1.0.0" as const;
  readonly #name = "Eve Vault" as const;

  #accounts: ReadonlyWalletAccount[] = [];
  #eventListeners = new Map<string, WalletEventListener[]>();
  #currentChain: SuiChain = SUI_DEVNET_CHAIN;

  get version() {
    return this.#version;
  }

  get name() {
    return this.#name;
  }

  get icon(): Wallet["icon"] {
    // You can replace this with your wallet's icon data URL
    return "data:image/png;base64,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" as `data:image/png;base64,${string}`;
  }

  get chains(): Wallet["chains"] {
    return [SUI_DEVNET_CHAIN, SUI_TESTNET_CHAIN] as `sui:${string}`[];
  }

  get accounts() {
    return this.#accounts.map(
      (walletAccount) =>
        new ReadonlyWalletAccount({
          address: walletAccount.address,
          publicKey: walletAccount.publicKey,
          chains: [SUI_DEVNET_CHAIN, SUI_TESTNET_CHAIN],
          // The features that this account supports. This can be a subset of the wallet's supported features.
          features: [
            StandardConnect,
            StandardDisconnect,
            SuiSignPersonalMessage,
            SuiSignTransaction,
            SuiSignAndExecuteTransaction,
            EVEFRONTIER_SPONSORED_TRANSACTION,
          ],
        }),
    );
  }

  get features(): EveVaultWalletFeatures {
    return {
      [StandardConnect]: {
        version: "1.0.0",
        connect: this.#connect,
      },
      [StandardEvents]: {
        version: "1.0.0",
        on: this.#on,
      },
      [SuiSignPersonalMessage]: {
        version: "1.1.0",
        signPersonalMessage: this.#signPersonalMessage,
      },
      [SuiSignTransaction]: {
        version: "2.0.0",
        signTransaction: this.#signTransaction,
      },
      [SuiSignAndExecuteTransaction]: {
        version: "2.0.0",
        signAndExecuteTransaction: this.#signAndExecuteTransaction,
      },
      [EVEFRONTIER_SPONSORED_TRANSACTION]: {
        version: "1.0.0",
        signSponsoredTransaction: this.#signEveFrontierSponsoredTransaction,
      },
    };
  }

  /**
   * Wallet Standard events subscription method
   * dApps call this via: wallet.features['standard:events'].on('change', callback)
   */
  #on: StandardEventsOnMethod = (event, listener) => {
    if (!this.#eventListeners.has(event)) {
      this.#eventListeners.set(event, []);
    }
    this.#eventListeners.get(event)?.push(listener);

    // Return unsubscribe function
    return () => {
      const listeners = this.#eventListeners.get(event);
      if (listeners) {
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  };

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
    accounts?: ReadonlyWalletAccount[];
    chains?: SuiChain[];
    features?: Record<string, unknown>;
  }) {
    const listeners = this.#eventListeners.get("change");
    if (!listeners || listeners.length === 0) return;

    // Per Wallet Standard spec: accounts should be all current accounts when accounts change
    // chains should be the changed chains when chain changes
    // features should be the changed features when features change
    const event = {
      accounts: properties.accounts !== undefined ? this.accounts : [],
      chains: properties.chains || [],
      features: properties.features || {},
    };

    // Call all registered listeners with the event
    listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        log.error("Error in wallet event listener", error);
      }
    });
  }

  /**
   * Update the current chain and emit a change event
   * Public method to allow external chain updates
   */
  setChain(chain: SuiChain): void {
    if (this.#currentChain !== chain) {
      this.#currentChain = chain;
      this.#emitChangeEvent({ chains: [chain] });
    }
  }

  setFeatures(features: IdentifierRecord<unknown>): void {
    if (features) {
      this.#emitChangeEvent({ features: features });
    }
  }

  /**
   * Remove all accounts and emit a change event
   * Called when user disconnects or logs out
   * Empty array when disconnected
   */
  disconnect(): void {
    if (this.#accounts.length > 0) {
      this.#accounts = [];
      this.#emitChangeEvent({ accounts: [] });
    }
  }

  // Not authenticated, trigger login flow
  #connect: StandardConnectMethod = async () => {
    return new Promise<StandardConnectOutput>((resolve, reject) => {
      const id = crypto.randomUUID();

      const onMsg = async (e: MessageEvent) => {
        const m = e.data || {};

        if (m.__from !== "Eve Vault" || m.id !== id) return;
        window.removeEventListener("message", onMsg);
        if (m.type === "auth_success") {
          const result = m.token;

          sessionStorage.setItem(
            "evevault_jwt",
            JSON.stringify(result.access_token),
          );

          if (result) {
            const zkLoginResponse = await getZkLoginAddress({
              jwt: result.access_token,
              enokiApiKey: import.meta.env.VITE_ENOKI_API_KEY,
            });

            if (zkLoginResponse.error) {
              throw new Error(zkLoginResponse.error.message);
            }

            if (!zkLoginResponse.data) {
              throw new Error("No data returned from zkLogin address lookup");
            }

            const { address } = zkLoginResponse.data;
            const newAccount = new ReadonlyWalletAccount({
              address,
              publicKey: new Uint8Array(),
              chains: [SUI_DEVNET_CHAIN, SUI_TESTNET_CHAIN],
              features: [
                SuiSignPersonalMessage,
                SuiSignTransaction,
                SuiSignAndExecuteTransaction,
              ],
            });

            this.#accounts = [newAccount];

            // Emit accounts change event - per spec, accounts array contains all current accounts
            this.#emitChangeEvent({ accounts: this.#accounts });
          }

          resolve({ accounts: this.#accounts });
        } else reject(new Error(m.error?.message || "Authentication failed"));
      };

      // Trigger login
      window.addEventListener("message", onMsg);
      window.postMessage({ __to: "Eve Vault", type: "connect", id }, "*");
    });
  };

  #signPersonalMessage: SuiSignPersonalMessageMethod = async (
    input: SuiSignPersonalMessageInput,
  ) => {
    return new Promise<SuiSignPersonalMessageOutput>((resolve, reject) => {
      const onMsg = async (e: MessageEvent) => {
        const m = e.data || {};

        if (m.__from !== "Eve Vault") return;
        window.removeEventListener("message", onMsg);

        if (m.type === "sign_success") {
          resolve({
            bytes: m.bytes,
            signature: m.signature,
          } as SuiSignPersonalMessageOutput);
        } else if (m.type === "sign_personal_message_error") {
          reject(new Error(m.error));
        }
      };

      window.addEventListener("message", onMsg);
      log.debug("[SuiWallet] #signPersonalMessage input", input);
      window.postMessage(
        {
          __to: "Eve Vault",
          id: crypto.randomUUID(),
          action: "sign_personal_message",
          message: input.message,
          account: input.account,
        },
        "*",
      );
    });
  };

  #signTransaction: SuiSignTransactionMethod = async (
    input: SuiSignTransactionInput,
  ) => {
    const tx = await input.transaction.toJSON();

    return new Promise<SignedTransaction>((resolve, reject) => {
      const onMsg = async (e: MessageEvent) => {
        const m = e.data || {};

        log.debug("[SuiWallet] #signTransaction message", m);

        if (m.type === "sign_success") {
          resolve({
            bytes: m.bytes,
            signature: m.signature,
          });
        } else if (m.type === "sign_transaction_error") {
          reject(new Error(m.error));
        }
      };

      window.addEventListener("message", onMsg);

      window.postMessage(
        {
          __to: "Eve Vault",
          id: crypto.randomUUID(),
          action: "sign_transaction",
          transaction: tx,
          account: input.account,
          chain: input.chain,
        },
        "*",
      );
    });
  };

  #signAndExecuteTransaction: SuiSignAndExecuteTransactionMethod = async (
    input: SuiSignAndExecuteTransactionInput,
  ) => {
    return new Promise<SuiSignAndExecuteTransactionOutput>(
      (resolve, reject) => {
        const messageListener = (message: unknown) => {
          if (!isSignAndExecuteTransactionMessage(message)) {
            return;
          }

          if (message.type === "sign_and_execute_transaction_success") {
            chrome.runtime.onMessage.removeListener(messageListener);
            resolve(message.result);
          } else if (message.type === "sign_and_execute_transaction_error") {
            chrome.runtime.onMessage.removeListener(messageListener);
            reject(new Error(message.error));
          }
        };

        chrome.runtime.onMessage.addListener(messageListener);

        chrome.runtime.sendMessage({
          action: WalletStandardMessageTypes.SIGN_AND_EXECUTE_TRANSACTION,
          transaction: input.transaction,
          account: input.account,
          chain: input.chain,
        });
      },
    );
  };

  #signEveFrontierSponsoredTransaction: EveFrontierSponsoredTransactionMethod =
    async (input: EveFrontierSponsoredTransactionInput) => {
      const tx = await input.transaction.toJSON();

      return new Promise<EveFrontierSponsoredTransactionOutput>(
        (resolve, reject) => {
          const onMsg = async (e: MessageEvent) => {
            const m = e.data || {};

            log.debug("[SuiWallet] #signSponsoredTransaction message", m);

            if (m.type === "sign_success") {
              resolve({
                digest: "123",
                effects: "123",
              });
            } else if (m.type === "sign_transaction_error") {
              reject(new Error(m.error));
            }
          };

          window.addEventListener("message", onMsg);

          window.postMessage(
            {
              __to: "Eve Vault",
              id: crypto.randomUUID(),
              action:
                WalletStandardMessageTypes.EVEFRONTIER_SIGN_SPONSORED_TRANSACTION,
              transaction: tx,
            },
            "*",
          );
        },
      );
    };
}
