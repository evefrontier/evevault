import {
  type User,
  UserManager,
  type UserManagerSettings,
  WebStorageStateStore,
} from "oidc-client-ts";
import { isExtension } from "../utils/environment";
import { createLogger } from "../utils/logger";
import { patchUserNonce } from "./patchNonce";
import { getTenantConfig } from "./tenantConfig";
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

function buildUserManagerSettings(tenantId: string): UserManagerSettings {
  const { clientId, clientSecret, serverUrl } = getTenantConfig(tenantId);
  return {
    authority: serverUrl,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: getRedirectUri(),
    post_logout_redirect_uri: getOrigin(),
    response_type: "code",
    automaticSilentRenew: true,
    accessTokenExpiringNotificationTimeInSeconds: 3,
    scope: "openid email profile offline_access",
    stateStore: new WebStorageStateStore({
      store: localStorage,
      prefix: `evevault.oidc.${tenantId}.`,
    }),
  };
}

const log = createLogger();

const userManagerCache = new Map<string, UserManager>();

function addUserManagerEventHandlers(
  userManager: UserManager,
  tenantId: string,
): void {
  userManager.events.addUserLoaded((user) => {
    log.info("OIDC user loaded", { tenantId, subject: user?.profile?.sub });
    void import("./stores/authStore").then((m) =>
      m.useAuthStore.getState().setUser(user),
    );
  });

  userManager.events.addUserUnloaded(() => {
    log.info("OIDC user unloaded", { tenantId });
    void import("./stores/authStore").then((m) =>
      m.useAuthStore.getState().setUser(null),
    );
  });

  userManager.events.addSilentRenewError((error) => {
    log.error("OIDC silent renew error", { tenantId, error });
  });

  userManager.events.addAccessTokenExpiring(async () => {
    log.info("Access token expiring, patching user nonce before refresh", {
      tenantId,
    });

    const currentUser = await userManager.getUser();
    if (!currentUser) {
      log.warn("User parameter is undefined", { tenantId });
    }

    const { useDeviceStore } = await import("../stores/deviceStore");
    const { useNetworkStore } = await import("../stores/networkStore");
    const deviceStore = useDeviceStore.getState();
    const networkStore = useNetworkStore.getState();
    const currentChain = networkStore.chain;
    const nonce = deviceStore.getNonce(currentChain);

    if (!nonce) {
      log.error("No nonce available for patching before token refresh", {
        tenantId,
      });
      return;
    }

    await patchUserNonce(currentUser as User, nonce);
  });

  userManager.events.addAccessTokenExpired(() => {
    log.warn(
      "Access token has already expired - addAccessTokenExpiring may have missed it",
      { tenantId },
    );
  });
}

/**
 * Returns a UserManager for the given tenant. Cached per tenant.
 * Use getCurrentTenantId() from tenantStore when calling from app code.
 */
export function getUserManager(tenantId: string): UserManager {
  let instance = userManagerCache.get(tenantId);
  if (!instance) {
    const settings = buildUserManagerSettings(tenantId);
    instance = new UserManager(settings);
    addUserManagerEventHandlers(instance, tenantId);
    userManagerCache.set(tenantId, instance);
  }
  return instance;
}
