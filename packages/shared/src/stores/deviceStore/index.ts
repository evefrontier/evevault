import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { chromeStorageAdapter, localStorageAdapter } from "@/adapters";
import { ephKeyService } from "@/services/vaultService";
import type { DeviceState } from "@/types";
import { isWeb } from "@/utils/environment";
import { createLogger } from "@/utils/logger";
import { DEVICE_STORAGE_KEY } from "@/utils/storageKeys";
import { createInitActions } from "./actions/initActions";
import { createLockActions } from "./actions/lockActions";
import { createProofActions } from "./actions/proofActions";
import { createInitialNetworkData } from "./constants";
import { reconstructPublicKey } from "./keyHelpers";
import { createDeviceSelectors } from "./selectors";

const log = createLogger();

export { createEmptyNetworkDataEntry } from "./constants";
export { registerOnLock } from "./runtime";

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set, get) => ({
      isLocked: true,
      ephemeralPublicKey: null,
      ephemeralPublicKeyBytes: null,
      ephemeralPublicKeyFlag: null,
      ephemeralKeyPairSecretKey: null,
      networkData: createInitialNetworkData(),
      loading: false,
      error: null,

      ...createDeviceSelectors(get),
      ...createInitActions(set, get),
      ...createProofActions(set, get),
      ...createLockActions(set, get),
    }),
    {
      name: DEVICE_STORAGE_KEY,
      storage: createJSONStorage(() =>
        isWeb() ? localStorageAdapter : chromeStorageAdapter,
      ),
      partialize: (state) => {
        return {
          ...state,
          ephemeralPublicKey: undefined,
          loading: undefined,
          error: undefined,
        };
      },
      onRehydrateStorage: () => {
        return (state, error) => {
          if (error) {
            log.error("Error rehydrating device store", error);
            return;
          }

          if (
            state?.ephemeralKeyPairSecretKey &&
            typeof state.ephemeralKeyPairSecretKey === "object"
          ) {
            const key = state.ephemeralKeyPairSecretKey;
            if (!("iv" in key) || !("data" in key)) {
              log.warn(
                "Invalid ephemeralKeyPairSecretKey structure on rehydration, setting to null",
                {
                  hasIv: "iv" in key,
                  hasData: "data" in key,
                  keys: Object.keys(key),
                },
              );
              state.ephemeralKeyPairSecretKey = null;
            }
          }

          if (state?.ephemeralPublicKeyBytes) {
            const publicKey = reconstructPublicKey(
              state.ephemeralPublicKeyBytes,
              state.ephemeralPublicKeyFlag ?? null,
            );

            if (publicKey) {
              state.ephemeralPublicKey = publicKey;
              log.debug(
                `Reconstructed ${isWeb() ? "Secp256r1" : "Ed25519"} public key from storage`,
              );
            } else {
              state.ephemeralPublicKey = null;
              state.ephemeralPublicKeyBytes = null;
              state.ephemeralPublicKeyFlag = null;
            }
          }

          if (
            state?.ephemeralPublicKeyBytes &&
            !state?.ephemeralKeyPairSecretKey
          ) {
            log.warn(
              "Inconsistent state on rehydration: have ephemeralPublicKeyBytes but ephemeralKeyPairSecretKey is null/missing. This indicates the secret key was lost from storage.",
              {
                hasEphemeralPublicKeyBytes: !!state.ephemeralPublicKeyBytes,
                hasEphemeralKeyPairSecretKey: !!state.ephemeralKeyPairSecretKey,
              },
            );
            state.ephemeralPublicKey = null;
            state.ephemeralPublicKeyBytes = null;
            state.ephemeralPublicKeyFlag = null;
            state.isLocked = true;
          }

          if (isWeb() && state) {
            state.isLocked = !ephKeyService.isUnlocked();
            state.loading = false;
          }
        };
      },
    },
  ),
);

export const waitForDeviceHydration = async () => {
  if (useDeviceStore.persist.hasHydrated()) {
    return;
  }

  await new Promise<void>((resolve) => {
    const unsub = useDeviceStore.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
    useDeviceStore.persist.rehydrate();
  });
};

export const rehydrateDeviceStore = async () => {
  await new Promise<void>((resolve) => {
    const unsub = useDeviceStore.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
    useDeviceStore.persist.rehydrate();
  });
};
