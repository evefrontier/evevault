import { hasJwtForNetwork, useAuth } from "@evevault/shared/auth";
import { useToast } from "@evevault/shared/components";
import {
  rehydrateDeviceStore,
  useDeviceStore,
} from "@evevault/shared/stores/deviceStore";
import { useNetworkStore } from "@evevault/shared/stores/networkStore";
import { AVAILABLE_NETWORKS, getNetworkLabel } from "@evevault/shared/types";
import { createLogger } from "@evevault/shared/utils";
import type { SuiChain } from "@mysten/wallet-standard";
import { useCallback } from "react";

const log = createLogger();

/**
 * Hook for handling login with network rollback on failure
 */
export function useLogin() {
  const { login, initialize: initializeAuth } = useAuth();
  const { chain } = useNetworkStore();
  const { showToast } = useToast();

  // Helper function to handle login rollback to a network with valid JWT
  const handleLoginRollback = useCallback(
    async (
      previousNetwork: SuiChain | null,
      currentChain: SuiChain,
    ): Promise<boolean> => {
      // First, check if we have a JWT for the previous network
      if (previousNetwork) {
        const hasJwtForPrevious = await hasJwtForNetwork(previousNetwork);
        if (hasJwtForPrevious) {
          const previousNetworkLabel = getNetworkLabel(previousNetwork);
          log.info("Reverting to previous network after login failure", {
            previousNetwork,
            currentNetwork: currentChain,
          });
          useNetworkStore.getState().forceSetChain(previousNetwork);
          await initializeAuth();
          showToast(
            `Login failed. Reverted to ${previousNetworkLabel} where you are still logged in.`,
          );
          return true;
        }
      }

      // Check if we have a JWT for any other network (parallel check for better performance)
      const allNetworks = AVAILABLE_NETWORKS.map((n) => n.chain).filter(
        (n) => n !== currentChain,
      );

      const jwtChecks = await Promise.all(
        allNetworks.map(async (network) => ({
          network,
          hasJwt: await hasJwtForNetwork(network),
        })),
      );

      const networkWithJwt = jwtChecks.find((check) => check.hasJwt)?.network;
      if (networkWithJwt) {
        const networkLabel = getNetworkLabel(networkWithJwt);
        log.info("Reverting to network with valid JWT after login failure", {
          network: networkWithJwt,
          currentNetwork: currentChain,
        });
        useNetworkStore.getState().forceSetChain(networkWithJwt);
        await initializeAuth();
        showToast(
          `Login failed. Reverted to ${networkLabel} where you are still logged in.`,
        );
        return true;
      }

      return false;
    },
    [initializeAuth, showToast],
  );

  const handleLogin = useCallback(
    async (previousNetworkBeforeSwitch: SuiChain | null) => {
      // Check if vault is locked
      const { isLocked } = useDeviceStore.getState();
      if (isLocked) {
        showToast("Please unlock the vault first before signing in.");
        return false;
      }

      try {
        const tokenResponse = await login();
        if (!tokenResponse) {
          log.error("Login failed: no token received");

          // Attempt to rollback to a network with valid JWT
          const rolledBack = await handleLoginRollback(
            previousNetworkBeforeSwitch,
            chain || "sui:devnet",
          );

          if (!rolledBack) {
            // No valid JWT found on any network
            showToast("Login failed. Please try again.");
          }
          return false;
        }

        log.info("Login successful", { hasToken: Boolean(tokenResponse) });

        // Rehydrate device store to sync with the latest networkData from background
        // The background handler updates Chrome storage with new device data (nonce, maxEpoch)
        // after login, but the popup's Zustand store has a separate instance that needs
        // to be refreshed from storage to see those updates.
        try {
          await rehydrateDeviceStore();
          log.debug("Device store rehydrated after login");
        } catch (rehydrateError) {
          log.warn(
            "Failed to rehydrate device store after login",
            rehydrateError,
          );
          // Don't fail the login if rehydration fails - user can still use the app
          // but may need to close/reopen popup for fresh device data
        }

        return true;
      } catch (err) {
        log.error("Login error", err);

        // Attempt to rollback to a network with valid JWT
        const rolledBack = await handleLoginRollback(
          previousNetworkBeforeSwitch,
          chain || "sui:devnet",
        );

        if (!rolledBack) {
          // No valid JWT found on any network
          showToast("Login failed. Please try again.");
        }
        return false;
      }
    },
    [login, chain, handleLoginRollback, showToast],
  );

  return { handleLogin };
}
