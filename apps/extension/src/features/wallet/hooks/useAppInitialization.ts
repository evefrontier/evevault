import { useAuth } from "@evevault/shared/auth";
import {
  registerOnLock,
  useDeviceStore,
} from "@evevault/shared/stores/deviceStore";
import { useNetworkStore } from "@evevault/shared/stores/networkStore";
import { createLogger, DEVICE_STORAGE_KEY } from "@evevault/shared/utils";
import { useEffect, useState } from "react";

const log = createLogger();

/**
 * Hook for initializing app stores and handling initialization state
 */
export function useAppInitialization() {
  const { initialize: initializeAuth, loading: authLoading } = useAuth();
  const { initialize: initializeNetwork } = useNetworkStore();
  const { loading: deviceLoading } = useDeviceStore();

  const [initError, setInitError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    registerOnLock(() => {
      if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({
          event: "change",
          payload: { accounts: [] },
        });
      }
    });
    return () => registerOnLock(null);
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const initializeStores = async () => {
      try {
        log.info("Initializing stores");
        await initializeAuth();
        await initializeNetwork();

        // Subscribe to device store changes for debugging
        unsubscribe = useDeviceStore.subscribe(async (state, prevState) => {
          log.debug("Device store changed", { state, prevState });
          const storageSnapshot = await chrome.storage.local.get([
            DEVICE_STORAGE_KEY,
          ]);
          log.debug("Storage after change", storageSnapshot);
        });

        log.info("Auth & network stores initialized successfully");
        setIsInitializing(false);
      } catch (error) {
        log.error("Error initializing stores", error);
        setInitError(
          error instanceof Error ? error.message : "Failed to initialize",
        );
        setIsInitializing(false);
      }
    };

    initializeStores();

    // Cleanup subscription on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [initializeAuth, initializeNetwork]);

  return {
    initError,
    isInitializing: isInitializing || authLoading || deviceLoading,
  };
}
