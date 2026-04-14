import { useAuth } from "@evevault/shared/auth";
import { useToast } from "@evevault/shared/components";
import {
  rehydrateDeviceStore,
  useDeviceStore,
} from "@evevault/shared/stores/deviceStore";
import { useNetworkStore } from "@evevault/shared/stores/networkStore";
import { createLogger } from "@evevault/shared/utils";
import { useCallback } from "react";

const log = createLogger();

/**
 * Hook for handling login with network rollback on failure
 */
export function useLogin() {
  const { login } = useAuth();
  const { chain } = useNetworkStore();
  const { showToast } = useToast();

  const handleLogin = useCallback(async () => {
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
      return false;
    }
  }, [login, chain, showToast]);

  return { handleLogin };
}
