import { createLogger } from "@evevault/shared/utils";
import {
  type IdentifierRecord,
  type ReadonlyWalletAccount,
  registerWallet,
  type SuiChain,
} from "@mysten/wallet-standard";
import { EveVaultWallet } from "../src/lib/adapters/SuiWallet";

const WALLET_REGISTRATION_KEY = "__evevault_registered__";
type EveVaultRegistrationWindow = Window & {
  [WALLET_REGISTRATION_KEY]?: boolean;
};

const log = createLogger();

export default defineUnlistedScript(() => {
  // Wait a bit for the wallet standard to be ready
  setTimeout(async () => {
    const registrationWindow = window as EveVaultRegistrationWindow;
    if (registrationWindow[WALLET_REGISTRATION_KEY]) {
      log.info("Eve Vault already registered, skipping");
      return;
    } else {
      try {
        const walletInstance: EveVaultWallet | null = new EveVaultWallet();
        registerWallet(walletInstance);

        registrationWindow[WALLET_REGISTRATION_KEY] = true;

        log.info("Eve Vault registered successfully");

        // Listen for messages from the extension (chain changes, logout, etc.)
        window.addEventListener("message", (event) => {
          if (event.source !== window) return;

          const data = event.data || {};

          const {
            chains,
            accounts,
            features,
          }: {
            chains?: SuiChain[];
            accounts?: ReadonlyWalletAccount[];
            features?: IdentifierRecord<unknown>;
          } = data.payload || {};

          // Handle chain change events from the extension
          if (data.__from === "Eve Vault" && data.event === "change") {
            if (!walletInstance) return;

            // Handle chain changes
            if (chains?.length) {
              const [chain] = chains;
              if (chain) {
                walletInstance.setChain(chain);
              }
            }

            // Handle account changes, disconnect/logout events
            if (accounts !== undefined) {
              if (accounts.length === 0) {
                walletInstance.disconnect();
              }
            }

            // Handle feature changes
            if (features) {
              walletInstance.setFeatures(features);
            }
          }
        });
      } catch (error) {
        log.error("Failed to register wallet", error);
      }
    }
  }, 100);
});
