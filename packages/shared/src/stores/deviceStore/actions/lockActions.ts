import type { PublicKey } from "@mysten/sui/cryptography";
import { ephKeyService } from "#/services/vaultService";
import { createInitialNetworkData } from "#/stores/deviceStore/constants";
import { getOnLockCallback } from "#/stores/deviceStore/runtime";
import type { DeviceState } from "#/types";
import { isWeb } from "#/utils/environment";
import { createLogger } from "#/utils/logger";
import type { GetDeviceState, SetDeviceState } from "./types";

const log = createLogger();

export function createLockActions(set: SetDeviceState, get: GetDeviceState) {
  return {
    lock: async () => {
      await ephKeyService.lock();
      set({ isLocked: true });
      const onLockCallback = getOnLockCallback();
      if (onLockCallback) {
        onLockCallback();
      } else {
        log.error("No onLockCallback registered");
      }
    },

    unlock: async (pin: string) => {
      const setUnlockedState = (publicKey: PublicKey | null) => {
        if (publicKey) {
          set({
            isLocked: false,
            error: null,
            ephemeralPublicKey: publicKey,
            ephemeralPublicKeyBytes: Array.from(publicKey.toRawBytes()),
            ephemeralPublicKeyFlag: publicKey.flag(),
          });
        } else {
          set({ isLocked: false, error: null });
        }
      };

      try {
        const storedKey = get().ephemeralKeyPairSecretKey;

        if (!pin || pin.trim().length === 0) {
          set({ error: "PIN is required" });
          return;
        }

        if (isWeb()) {
          const hasKeypair = await ephKeyService.hasKeypair();
          if (!hasKeypair) {
            set({ error: "No keypair available" });
            return;
          }
          const publicKey = await ephKeyService.unlockVault(null, pin);
          setUnlockedState(publicKey);
          return;
        }

        if (!storedKey) {
          set({ error: "No secret key available" });
          return;
        }

        const publicKey = await ephKeyService.unlockVault(storedKey, pin);
        setUnlockedState(publicKey);
      } catch (error) {
        log.error("Error decrypting secret key", error);
        set({
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },

    reset: () => {
      set({
        isLocked: true,
        ephemeralPublicKey: null,
        ephemeralPublicKeyBytes: null,
        ephemeralPublicKeyFlag: null,
        ephemeralKeyPairSecretKey: null,
        networkData: createInitialNetworkData(),
        loading: false,
        error: null,
      });
    },
  } satisfies Pick<DeviceState, "lock" | "unlock" | "reset">;
}
