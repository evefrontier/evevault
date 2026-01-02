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

          // NOTE: Do NOT initialize device data here when switching networks without JWT.
          // Device data should only be created when the user actually logs in (in the background handler).
          // If we create it here, it will be regenerated again during login, causing nonce mismatch.
          // The background handler will create device data with the correct nonce during OAuth flow.

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

          // Check device data for the new chain
          const deviceStore = useDeviceStore.getState();
          const existingNonce = deviceStore.getNonce(chain);
          const existingMaxEpoch = deviceStore.getMaxEpoch(chain);
          const existingJwtRandomness = deviceStore.getJwtRandomness(chain);
          const maxEpochTimestampMs = deviceStore.getMaxEpochTimestampMs(chain);

          // Check if device data exists and is valid
          const hasValidDeviceData =
            existingNonce &&
            existingMaxEpoch &&
            existingJwtRandomness &&
            maxEpochTimestampMs &&
            Date.now() < maxEpochTimestampMs;

          if (!hasValidDeviceData) {
            // Device data is missing or expired, but we have a JWT
            // We cannot create new device data here because it would have a different nonce
            // than what's in the existing JWT, causing a nonce mismatch.
            // Allow the switch to proceed, but the user will need to re-login when they try
            // to use features that require device data (like signing transactions).
            // The getZkProof function will detect the nonce mismatch and prompt re-login.
            log.warn(
              "JWT exists but device data is missing/expired for chain - switch allowed but re-login will be required for transactions",
              {
                chain,
                hasNonce: !!existingNonce,
                hasMaxEpoch: !!existingMaxEpoch,
                hasJwtRandomness: !!existingJwtRandomness,
                maxEpochTimestampMs,
                isExpired: maxEpochTimestampMs
                  ? Date.now() >= maxEpochTimestampMs
                  : true,
              },
            );

            // Still allow the switch - user can see they're logged in
            // Re-login will be required when they try to sign transactions
            set({ loading: false });
            log.info(
              "Switched to chain (JWT exists but device data missing/expired - re-login required for transactions)",
              {
                chain,
              },
            );
            return { success: true, requiresReauth: false };
          }

          // Device data exists and is valid - seamless switch
          log.debug(
            "Device data valid for chain, proceeding with seamless switch",
            {
              chain,
            },
          );

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
