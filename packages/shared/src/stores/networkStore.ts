import {
  chromeStorageAdapter,
  localStorageAdapter,
} from "@evevault/shared/adapters";
import { hasJwtForNetwork, useAuthStore } from "@evevault/shared/auth";
import type { NetworkState, NetworkSwitchResult } from "@evevault/shared/types";
import { SUI_DEVNET_CHAIN, type SuiChain } from "@mysten/wallet-standard";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
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
    (set, get) => ({
      chain: getInitialChain(),
      loading: false,

      initialize: async () => {
        // Note: persist middleware already hydrates state from storage
        // This function just sets loading to false
        return set({
          loading: false,
        });
      },

      checkNetworkSwitch: async (
        chain: SuiChain,
      ): Promise<{ requiresReauth: boolean }> => {
        const currentChain = get().chain;

        // Same chain - no switch needed
        if (currentChain === chain) {
          return { requiresReauth: false };
        }

        // Check if we have a JWT for the target network
        const hasJwt = await hasJwtForNetwork(chain);
        return { requiresReauth: !hasJwt };
      },

      /**
       * Force set the chain without checking JWT status.
       * Used during logout-based network switching when we know re-auth is required.
       */
      forceSetChain: (chain: SuiChain) => {
        const currentChain = get().chain;
        if (currentChain !== chain) {
          log.info("Force setting chain (for logout-based switch)", {
            from: currentChain,
            to: chain,
          });
          set({ chain });
        }
      },

      setChain: async (chain: SuiChain): Promise<NetworkSwitchResult> => {
        const currentChain = get().chain;

        // Same chain - no switch needed
        if (currentChain === chain) {
          return { success: true, requiresReauth: false };
        }

        log.info("Setting chain", { from: currentChain, to: chain });

        // Check if we have a JWT for the target network
        const hasJwt = await hasJwtForNetwork(chain);

        // Switch network state immediately (even if no JWT)
        set({ chain, loading: true });

        if (!hasJwt) {
          // No JWT for target network - requires re-authentication
          // Re-initialize auth store to check JWT for new network
          // This will automatically set user to null if no JWT exists
          try {
            await useAuthStore.getState().initialize();
          } catch (error) {
            log.error(
              "Failed to initialize auth store after network switch",
              error,
            );
          }

          // Re-initialize device data for new network if vault is unlocked
          const deviceStore = useDeviceStore.getState();
          if (deviceStore.ephemeralPublicKey && !deviceStore.isLocked) {
            try {
              await deviceStore.initializeForChain(chain);
            } catch (error) {
              log.error(
                "Failed to initialize device data for new network",
                error,
              );
            }
          }

          set({ loading: false });
          log.info("Switched to chain (no JWT, re-authentication required)", {
            chain,
          });
          return { success: true, requiresReauth: true };
        }

        // We have a JWT - proceed with seamless switch

        try {
          // Notify extension about network change
          if (isExtension()) {
            chrome.runtime?.sendMessage?.({
              __from: "Eve Vault",
              event: "change",
              payload: { chains: [chain] },
            });
          }

          // Initialize device data for the new chain if needed
          const deviceStore = useDeviceStore.getState();
          const existingNonce = deviceStore.getNonce(chain);
          const existingMaxEpoch = deviceStore.getMaxEpoch(chain);
          const existingJwtRandomness = deviceStore.getJwtRandomness(chain);
          const maxEpochTimestampMs = deviceStore.getMaxEpochTimestampMs(chain);

          // Only regenerate if device data is truly missing or expired
          // If we have valid device data that matches our JWT, use it to avoid nonce mismatch
          const needsInitialization =
            !existingNonce ||
            !existingMaxEpoch ||
            !existingJwtRandomness ||
            !maxEpochTimestampMs ||
            Date.now() >= maxEpochTimestampMs;

          if (needsInitialization) {
            // Check if ephemeral key is available (vault unlocked)
            if (!deviceStore.ephemeralPublicKey) {
              log.warn(
                "Cannot initialize device data: vault locked or not set up",
                { chain },
              );
              // Still switch the chain, but warn that device data is missing
              // User will need to unlock vault to sign transactions
              set({ loading: false });
              log.info(
                "Switched to chain (vault locked, device data pending)",
                {
                  chain,
                },
              );
              return { success: true, requiresReauth: false };
            }

            log.info("Initializing device data for chain", { chain });
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

          set({ loading: false });
          log.info("Successfully switched to chain", { chain });
          return { success: true, requiresReauth: false };
        } catch (error) {
          log.error("Failed to complete network switch", error);
          set({ loading: false });
          // Revert to previous chain on error
          set({ chain: currentChain });
          return { success: false, requiresReauth: false };
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
