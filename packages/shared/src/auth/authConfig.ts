import {
  UserManager,
  type UserManagerSettings,
  WebStorageStateStore,
} from "oidc-client-ts";
import { isExtension } from "../utils/environment";
import { createLogger } from "../utils/logger";
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
  scope: "openid email profile",

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
  }
  return userManagerInstance;
}
