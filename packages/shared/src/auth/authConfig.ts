import {
  type User,
  UserManager,
  type UserManagerSettings,
  WebStorageStateStore,
} from "oidc-client-ts";
import { getCurrentTenantId } from "../stores/tenantStore";
import type { TenantId } from "../types";
import { isExtension } from "../utils/environment";
import { createLogger } from "../utils/logger";
import { getTenantConfig } from "../utils/tenantConfig";
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

function buildUserManagerSettings(tenantId: TenantId): UserManagerSettings {
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
export function getUserManager(tenantId: TenantId): UserManager {
  let instance = userManagerCache.get(tenantId);
  if (!instance) {
    const settings = buildUserManagerSettings(tenantId);
    instance = new UserManager(settings);
    addUserManagerEventHandlers(instance, tenantId);
    userManagerCache.set(tenantId, instance);
  }
  return instance;
}

/**
 * Redirects the user to FusionAuth logout so the IdP session is cleared.
 * After logout, FusionAuth redirects back to post_logout_redirect_uri (app origin).
 * Use for both app logout and after device reset so the next login requires email/password.
 */
export function redirectToFusionAuthLogout(): void {
  const tenantId = getCurrentTenantId();
  const { clientId, serverUrl: fusionAuthUrl } = getTenantConfig(tenantId);
  const postRedirectUri = isExtension()
    ? (typeof chrome !== "undefined" && chrome.identity?.getRedirectURL?.()) ||
      getOrigin()
    : getOrigin();
  if (!fusionAuthUrl || !clientId || !postRedirectUri) {
    log.warn(
      "Missing FusionAuth config for logout redirect, falling back to origin",
    );
    if (typeof window !== "undefined") {
      window.location.href = window.location.origin;
    }
    return;
  }
  const logoutUrl = new URL(
    `${String(fusionAuthUrl).replace(/\/$/, "")}/oauth2/logout`,
  );
  logoutUrl.searchParams.set("client_id", clientId);
  logoutUrl.searchParams.set("post_logout_redirect_uri", postRedirectUri);

  if (
    isExtension() &&
    typeof chrome !== "undefined" &&
    chrome.identity?.launchWebAuthFlow
  ) {
    chrome.identity.launchWebAuthFlow(
      { url: logoutUrl.toString(), interactive: true },
      () => {
        chrome.runtime?.sendMessage?.({
          __from: "Eve Vault",
          event: "change",
          payload: { accounts: [] },
        });
      },
    );
  } else if (typeof window !== "undefined") {
    window.location.href = logoutUrl.toString();
  }
}
