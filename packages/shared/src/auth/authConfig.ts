import {
  type User,
  UserManager,
  type UserManagerSettings,
  WebStorageStateStore,
} from "oidc-client-ts";
import { isExtension } from "../utils/environment";
import { createLogger } from "../utils/logger";
import { patchUserNonce } from "./patchNonce";
import type { GlobalWithLocalStorage, StorageLike } from "./types";

const ensureLocalStorage = () => {
  if (
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined"
  ) {
    return;
  }

  const memoryStorage: Record<string, string> = {};
  const storagePolyfill: StorageLike = {
    getItem: (key: string) => {
      return key in memoryStorage ? memoryStorage[key] : null;
    },
    setItem: (key: string, value: string) => {
      memoryStorage[key] = String(value);
    },
    removeItem: (key: string) => {
      delete memoryStorage[key];
    },
    clear: () => {
      Object.keys(memoryStorage).forEach((key) => {
        delete memoryStorage[key];
      });
    },
    key: (index: number) => {
      const keys = Object.keys(memoryStorage);
      return index >= 0 && index < keys.length ? keys[index] : null;
    },
    get length() {
      return Object.keys(memoryStorage).length;
    },
  };

  const globalObj = globalThis as GlobalWithLocalStorage;
  globalObj.localStorage = storagePolyfill;
};

// Before any other code runs ensure localStorage exists in all environments
ensureLocalStorage();

const getRedirectUri = () => {
  if (isExtension() && chrome.runtime?.id) {
    return `chrome-extension://${chrome.runtime.id}/callback.html`;
  }
  if (typeof window !== "undefined" && window.location) {
    return `${window.location.origin}/callback`;
  }
  return "/callback"; // Fallback
};

const getOrigin = () => {
  if (isExtension() && chrome.runtime?.id) {
    return `chrome-extension://${chrome.runtime.id}`;
  }
  if (typeof window !== "undefined" && window.location) {
    return window.location.origin;
  }
  return ""; // Fallback empty string
};

// Define FusionAuth OAuth settings
const fusionAuthConfig: UserManagerSettings = {
  authority: import.meta.env.VITE_FUSION_SERVER_URL,
  client_id: import.meta.env.VITE_FUSIONAUTH_CLIENT_ID,
  client_secret: import.meta.env.VITE_FUSION_CLIENT_SECRET,
  redirect_uri: getRedirectUri(),
  post_logout_redirect_uri: getOrigin(),
  response_type: "code",
  automaticSilentRenew: true,
  accessTokenExpiringNotificationTimeInSeconds: 3,
  scope: "openid email profile offline_access",

  // We can safely use WebStorageStateStore since localStorage is guaranteed to exist
  stateStore: new WebStorageStateStore({
    store: localStorage,
    prefix: "evevault.oidc.",
  }),
};

const log = createLogger();

let userManagerInstance: UserManager | null = null;

export function getUserManager(): UserManager {
  if (!userManagerInstance) {
    userManagerInstance = new UserManager(fusionAuthConfig);

    // Add logging to track OIDC operations
    userManagerInstance.events.addUserLoaded((user) => {
      log.info("OIDC user loaded", { subject: user?.profile?.sub });
    });

    userManagerInstance.events.addUserUnloaded(() => {
      log.info("OIDC user unloaded");
    });

    userManagerInstance.events.addSilentRenewError((error) => {
      log.error("OIDC silent renew error", error);
    });

    userManagerInstance.events.addAccessTokenExpiring(async () => {
      log.info("Access token expiring, patching user nonce before refresh");

      // Get user from parameter or fallback to UserManager
      const currentUser = await userManagerInstance?.getUser();
      if (!currentUser) {
        log.warn("User parameter is undefined");
      }

      const { useDeviceStore } = await import("../stores/deviceStore");
      const { useNetworkStore } = await import("../stores/networkStore");
      const deviceStore = useDeviceStore.getState();
      const networkStore = useNetworkStore.getState();
      const currentChain = networkStore.chain;
      const nonce = deviceStore.getNonce(currentChain);

      if (!nonce) {
        log.error("No nonce available for patching before token refresh");
        return;
      }

      await patchUserNonce(currentUser as User, nonce);
    });

    userManagerInstance.events.addAccessTokenExpired(() => {
      log.warn(
        "Access token has already expired - addAccessTokenExpiring may have missed it",
      );
    });
  }
  return userManagerInstance;
}
