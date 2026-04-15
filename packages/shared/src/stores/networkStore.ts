import { SUI_TESTNET_CHAIN, type SuiChain } from "@mysten/wallet-standard";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { chromeStorageAdapter, localStorageAdapter } from "../adapters";
import { hasJwt, useAuthStore } from "../auth";
import type { NetworkState, NetworkSwitchResult } from "../types";
import { createLogger, isExtension, isWeb } from "../utils";
import { NETWORK_STORAGE_KEY } from "../utils/storageKeys";
import { useDeviceStore } from "./deviceStore";

const log = createLogger();

// Helper function to get initial chain from storage
// For web: reads synchronously from localStorage
// For extension: returns fallback - persist middleware will hydrate
const getInitialChain = (): SuiChain => {
  if (isWeb() && typeof window !== "undefined" && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(NETWORK_STORAGE_KEY);
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
  return SUI_TESTNET_CHAIN;
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

        // Check if we have a JWT
        const jwtExists = await hasJwt();
        return { requiresReauth: !jwtExists };
      },

      /**
       * Set chain for re-authentication flow (skips JWT checks).
       * Called by NetworkSelector when switching to a network without JWT.
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

        // Check if we have a JWT
        const jwtExists = await hasJwt();

        // Switch network state immediately (even if no JWT)
        set({ chain, loading: true });

        if (!jwtExists) {
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

          // Pre-initialize device data for the new chain so it's ready for vendJwt after login.
          try {
            await useDeviceStore.getState().initializeForChain(chain);
          } catch (error) {
            // May fail if ephemeral key is not yet loaded (e.g. vault locked); login flow will retry.
            log.warn(
              "Could not pre-initialize device data for chain during network switch",
              { chain, error },
            );
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

          // Ensure device data is present and valid for the new chain.
          const deviceStore = useDeviceStore.getState();
          const networkData = deviceStore.networkData[chain];
          const isExpired =
            networkData?.maxEpochTimestampMs != null &&
            Date.now() >= networkData.maxEpochTimestampMs;
          if (!networkData?.nonce || !networkData?.maxEpoch || isExpired) {
            await deviceStore.initializeForChain(chain);
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
      name: NETWORK_STORAGE_KEY,
      storage: createJSONStorage(() =>
        isWeb() ? localStorageAdapter : chromeStorageAdapter,
      ),
      partialize: (state) => ({ chain: state.chain }),
    },
  ),
);

// In extension, sync network store when another context updates chrome.storage
if (typeof chrome !== "undefined" && chrome.storage && !isWeb()) {
  const storage = chrome.storage as {
    onChanged?: {
      addListener: (
        callback: (changes: Record<string, unknown>, areaName: string) => void,
      ) => void;
    };
  };
  storage.onChanged?.addListener(
    (changes: Record<string, unknown>, areaName: string) => {
      if (areaName === "local" && changes[NETWORK_STORAGE_KEY]) {
        void useNetworkStore.persist.rehydrate();
      }
    },
  );
}
