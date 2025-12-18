import {
  chromeStorageAdapter,
  localStorageAdapter,
} from "@evevault/shared/adapters";
import type { NetworkState, TokenResponse } from "@evevault/shared/types";
import { SUI_DEVNET_CHAIN, type SuiChain } from "@mysten/wallet-standard";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useAuthStore } from "../auth";
import { isExtension, isWeb } from "../utils/environment";
import { createLogger } from "../utils/logger";
import { useDeviceStore } from "./deviceStore";

const log = createLogger();

// Helper function to get initial chain from storage
// For web: reads synchronously from localStorage
// For extension: returns fallback - persist middleware will hydrate
const getInitialChain = (): SuiChain => {
  if (isWeb() && typeof window !== "undefined" && window.localStorage) {
    try {
      const stored = window.localStorage.getItem("evevault:network");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.state?.chain) {
          return parsed.state.chain;
        }
      }
    } catch (error) {
      log.error("Error reading initial chain from localStorage", error);
    }
  }
  // For extension, persist middleware will handle hydration asynchronously
  // Return fallback - persist middleware will overwrite with persisted value
  return SUI_DEVNET_CHAIN;
};

// Create the store
export const useNetworkStore = create<NetworkState>()(
  persist(
    (set, _get) => ({
      chain: getInitialChain(),
      loading: false,

      initialize: async () => {
        // Note: persist middleware already hydrates state from storage
        // This function just sets loading to false
        return set({
          loading: false,
        });
      },

      setChain: async (chain: SuiChain) => {
        log.info("Setting chain", { chain });

        // Set the chain first
        set({ chain: chain as SuiChain });

        if (isExtension()) {
          try {
            chrome.runtime?.sendMessage?.({
              __from: "Eve Vault",
              event: "change",
              payload: { chains: [chain] },
            });

            try {
              // CRITICAL: Ensure device data exists for this chain BEFORE refreshing JWT
              const deviceStore = useDeviceStore.getState();
              const existingNonce = deviceStore.getNonce(chain);
              const existingMaxEpoch = deviceStore.getMaxEpoch(chain);

              if (!existingNonce || !existingMaxEpoch) {
                log.info("Initializing device data before refreshing JWT", {
                  chain,
                });
                await deviceStore.initializeForChain(chain);

                // Verify device data was created
                const verifyNonce = deviceStore.getNonce(chain);
                const verifyMaxEpoch = deviceStore.getMaxEpoch(chain);

                if (!verifyNonce || !verifyMaxEpoch) {
                  throw new Error(
                    `Failed to initialize device data for chain ${chain}. Nonce: ${verifyNonce}, MaxEpoch: ${verifyMaxEpoch}`,
                  );
                }

                log.debug("Device data verified for chain", { chain });
              }

              const { "evevault:jwt": allNetworkTokens } = await new Promise<{
                "evevault:jwt"?: Record<SuiChain, TokenResponse>;
              }>((resolve) => {
                chrome.storage.local.get("evevault:jwt", (items) =>
                  resolve(items),
                );
              });

              const token = allNetworkTokens?.[chain];

              if (!token) {
                log.info("Refreshing JWT for chain", { chain });
                const authStore = useAuthStore.getState();
                await authStore.refreshJwt(chain);
              } else {
                log.debug("Existing JWT found for chain", { chain });
              }
            } catch (error) {
              log.error("Token refresh failed during chain change", error);
              throw error;
            }
          } catch (error) {
            log.error("Failed to notify extension about network change", error);
          }
        }
      },
    }),
    {
      name: "evevault:network",
      storage: createJSONStorage(() =>
        isWeb() ? localStorageAdapter : chromeStorageAdapter,
      ),
    },
  ),
);
