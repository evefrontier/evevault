import type { SuiChain } from "@mysten/wallet-standard";
import { decodeJwt } from "jose";
import { type IdTokenClaims, User } from "oidc-client-ts";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { chromeStorageAdapter, localStorageAdapter } from "../../adapters";
import { zkProofService } from "../../services/vaultService";
import { useDeviceStore, useNetworkStore } from "../../stores";
import {
  getCurrentTenantId,
  OAuthTenantSessionKey,
  setCurrentTenantId,
} from "../../stores/tenantStore";
import type { AuthMessage, JwtResponse, TenantId } from "../../types";
import {
  createLogger,
  isBrowser,
  isExtension,
  isWeb,
  performFullCleanup,
} from "../../utils";
import { AUTH_STORAGE_KEY } from "../../utils/storageKeys";
import { DEFAULT_TENANT_ID, getTenantConfig } from "../../utils/tenantConfig";
import { getUserManager, redirectToFusionAuthLogout } from "../authConfig";
import {
  clearZkLoginAddressCache,
  getZkLoginAddress,
} from "../getZkLoginAddress";
import {
  clearAllJwts,
  clearZkLoginJwtForNetwork,
  getJwtForNetwork,
  storeJwt,
} from "../storageService";
import type { AuthState } from "../types";
import { resolveExpiresAt } from "../utils/authStoreUtils";

// biome-ignore lint/suspicious/noExplicitAny: chrome is a global object
declare const chrome: any;

const log = createLogger();

export const getEnokiApiKey = (): string => {
  if (isBrowser()) {
    const env = (import.meta as unknown as { env: Record<string, string> }).env;
    return env?.VITE_ENOKI_API_KEY ?? "";
  }
  // biome-ignore lint/suspicious/noExplicitAny: Node.js process.env access requires any type
  return (globalThis as any)?.process?.env?.VITE_ENOKI_API_KEY ?? "";
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => {
      // Lazy getter for userManager to avoid initialization order issues
      const getUserManagerInstance = () => getUserManager(getCurrentTenantId());

      return {
        user: null,
        loading: false,
        error: null,

        initialize: async () => {
          set({ loading: true });
          const platform = isExtension()
            ? "extension"
            : isWeb()
              ? "web"
              : "unknown";
          const network = useNetworkStore.getState().chain;

          // Log nonce comparison on app init for both platforms
          try {
            const deviceStore = useDeviceStore.getState();
            const deviceNonce = deviceStore.networkData[network]?.nonce;
            const storedJwtForNonceCheck = await getJwtForNetwork(network);

            if (storedJwtForNonceCheck?.id_token) {
              const decodedJwtForNonceCheck = decodeJwt(
                storedJwtForNonceCheck.id_token,
              );
              const jwtNonce = decodedJwtForNonceCheck.nonce as
                | string
                | undefined;

              log.info(
                `🔑 [${platform.toUpperCase()}] App init nonce check`,
                deviceNonce && jwtNonce ? deviceNonce === jwtNonce : "N/A",
                {
                  network,
                  deviceNonce: deviceNonce ?? "(not set)",
                  jwtNonce: jwtNonce ?? "(not set)",
                  noncesMatch:
                    deviceNonce && jwtNonce ? deviceNonce === jwtNonce : "N/A",
                  jwtSub: decodedJwtForNonceCheck.sub,
                  jwtExp: decodedJwtForNonceCheck.exp,
                },
              );
            } else {
              log.info(
                `🔑 [${platform.toUpperCase()}] App init nonce check`,
                "No JWT stored",
                {
                  network,
                  deviceNonce: deviceNonce ?? "(not set)",
                  jwtNonce: "(no JWT stored)",
                  noncesMatch: "N/A",
                },
              );
            }
          } catch (nonceCheckError) {
            log.warn(
              `[${platform.toUpperCase()}] Failed to check nonces on init`,
              nonceCheckError,
            );
          }

          try {
            if (isExtension() && typeof chrome !== "undefined") {
              // Use getJwtForNetwork instead of reading chrome.storage directly
              // This ensures we use the same logic as hasJwtForNetwork and avoid race conditions
              const storedJwt = await getJwtForNetwork(network);
              const idToken = storedJwt?.id_token;

              if (storedJwt && idToken) {
                // Check if JWT is expired
                const expiresAt = resolveExpiresAt(storedJwt);
                const now = Math.floor(Date.now() / 1000);
                if (now >= expiresAt) {
                  log.info("JWT expired for current network, clearing user", {
                    network,
                    expiresAt,
                    now,
                  });
                  set({ user: null, loading: false });
                  return;
                }

                log.info("Found JWT in chrome.storage, loading user");
                const currentUser = await getUserManagerInstance().getUser();
                if (!currentUser) {
                  log.info("Loading user from chrome storage JWT");
                  const decodedJwt = decodeJwt(idToken);

                  const zkLoginResponse = await getZkLoginAddress({
                    jwt: idToken,
                    enokiApiKey: getEnokiApiKey(),
                  });

                  if (zkLoginResponse.error) {
                    throw new Error(zkLoginResponse.error.message);
                  }

                  if (!zkLoginResponse.data) {
                    throw new Error("No zkLogin address data received");
                  }

                  const { salt, address } = zkLoginResponse.data;

                  const newUser = new User({
                    id_token: storedJwt.id_token,
                    access_token: storedJwt.access_token,
                    token_type: storedJwt.token_type,
                    scope: storedJwt.scope,
                    refresh_token: storedJwt.refresh_token,
                    profile: {
                      ...(decodedJwt as IdTokenClaims),
                      sui_address: address,
                      salt,
                    },
                    expires_at:
                      decodedJwt.exp ??
                      Math.floor(Date.now() / 1000) +
                        (storedJwt.expires_at ?? storedJwt.expires_in ?? 3600),
                  });
                  await getUserManagerInstance().storeUser(newUser);
                  set({ user: newUser, loading: false });
                  return; // Exit early after setting user
                }

                // Fallback for non-extension context
                const user = await getUserManagerInstance().getUser();
                set({ user, loading: false });
                return;
              }

              // No JWT found for this network
              // Set user to null - user needs to sign in again for this network
              log.info("No JWT found for current network, clearing user", {
                network,
              });
              set({ user: null, loading: false });
            }
            return set({ loading: false });
          } catch (error) {
            log.error("Error initializing auth", error);
            set({
              user: null,
              loading: false,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        },

        setUser: (user) => set({ user }),

        login: async () => {
          const network = useNetworkStore.getState().chain;
          set({ loading: true });

          if (isExtension()) {
            try {
              const jwtResponse = await get().extensionLogin();
              if (jwtResponse) {
                const decodedJwt = decodeJwt<IdTokenClaims>(
                  jwtResponse.id_token as string,
                );

                // Log nonce comparison after login
                const deviceStore = useDeviceStore.getState();
                const deviceNonce = deviceStore.networkData[network]?.nonce;
                const jwtNonce = decodedJwt.nonce as string | undefined;

                log.info("🔑 [EXTENSION] Nonce check after login", {
                  network,
                  deviceNonce: deviceNonce ?? "(not set)",
                  jwtNonce: jwtNonce ?? "(not set)",
                  noncesMatch:
                    deviceNonce && jwtNonce ? deviceNonce === jwtNonce : "N/A",
                });

                const zkLoginResponse = await getZkLoginAddress({
                  jwt: jwtResponse.id_token,
                  enokiApiKey: getEnokiApiKey(),
                });

                if (zkLoginResponse.error) {
                  throw new Error(zkLoginResponse.error.message);
                }

                if (!zkLoginResponse.data) {
                  throw new Error("No zkLogin address data received");
                }

                const { salt, address } = zkLoginResponse.data;

                const user = new User({
                  id_token: jwtResponse.id_token,
                  access_token: jwtResponse.access_token,
                  token_type: jwtResponse.token_type,
                  scope: jwtResponse.scope,
                  refresh_token: jwtResponse.refresh_token,
                  profile: {
                    ...(decodedJwt as IdTokenClaims),
                    sui_address: address,
                    salt,
                  },
                  expires_at:
                    Math.floor(Date.now() / 1000) + jwtResponse.expires_in,
                });

                await getUserManagerInstance().storeUser(user);
                set({ user, loading: false });

                return user as User;
              }
              set({ loading: false });
            } catch (error) {
              log.error("Extension login failed", error);
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              if (errorMessage !== "The user did not approve access.") {
                set({
                  error:
                    error instanceof Error ? error.message : "Unknown error",
                });
              }
              set({ loading: false });
            }
          } else {
            // Web login flow
            const deviceStore = useDeviceStore.getState();

            // Check if device data exists for current network, initialize if missing
            const networkData = deviceStore.networkData[network];
            if (!networkData?.nonce || !networkData?.maxEpoch) {
              log.info("Initializing device data for network before login", {
                network,
              });
              await deviceStore.initializeForChain(network);
            }

            // Get device params for OAuth
            const getDeviceParams = () => {
              const currentDeviceStore = useDeviceStore.getState();
              // Get per-network jwtRandomness (preferred) or fallback to global (for backwards compatibility)
              const jwtRandomness =
                currentDeviceStore.getJwtRandomness(network);
              const currentNetworkData =
                currentDeviceStore.networkData[network];

              if (!currentNetworkData) {
                throw new Error("Network data not found after initialization");
              }

              const { nonce, maxEpoch } = currentNetworkData;

              if (!nonce || !jwtRandomness || !maxEpoch) {
                throw new Error(
                  "Device data not initialized. OAuth params may be missing.",
                );
              }

              return {
                nonce,
                jwtRandomness,
                maxEpoch: String(maxEpoch),
              };
            };

            if (typeof sessionStorage !== "undefined") {
              sessionStorage.setItem(
                OAuthTenantSessionKey,
                getCurrentTenantId(),
              );
            }
            getUserManagerInstance().signinRedirect({
              nonce: getDeviceParams().nonce,
              extraQueryParams: {
                jwtRandomness: getDeviceParams().jwtRandomness,
                maxEpoch: getDeviceParams().maxEpoch,
              },
            });
            set({ loading: false });
          }
        },

        extensionLogin: async () => {
          return new Promise((resolve, reject) => {
            if (!isExtension()) {
              reject(new Error("Extension APIs unavailable in this context"));
              return;
            }

            const id = crypto.randomUUID();

            const authSuccessListener = (message: AuthMessage) => {
              // Only process messages with matching ID
              if (message.id === id) {
                if (message.type === "auth_success") {
                  chrome.runtime?.onMessage?.removeListener(
                    authSuccessListener,
                  );
                  if (!message.token) {
                    reject(new Error("No token received from auth"));
                    return;
                  }
                  resolve(message.token);
                } else if (message.type === "auth_error") {
                  chrome.runtime?.onMessage?.removeListener(
                    authSuccessListener,
                  );
                  reject(message.error);
                }
              }
            };

            chrome.runtime?.onMessage?.addListener(authSuccessListener);

            chrome.runtime?.sendMessage?.({
              action: "ext_login",
              id: id,
              tenantId: getCurrentTenantId(),
            });
          });
        },

        refreshJwt: async (network: SuiChain) => {
          try {
            const now = Math.floor(Date.now() / 1000);
            const existingJwt = await getJwtForNetwork(network);
            const expiresAt = existingJwt ? resolveExpiresAt(existingJwt) : 0;
            const isValid = !!(existingJwt?.id_token && now < expiresAt);

            if (isValid && existingJwt?.id_token) {
              log.debug("Primary OAuth JWT still valid, no refresh needed", {
                network,
              });
              return;
            }

            const tenant = getCurrentTenantId();
            const config = getTenantConfig(tenant);
            const { serverUrl, clientId, clientSecret } = config;
            const refreshToken = existingJwt?.refresh_token;

            if (!refreshToken?.trim()) {
              log.error("Token refresh failed: no refresh token");
              await get().logout();
              return;
            }

            const response = await fetch(
              `${serverUrl.replace(/\/$/, "")}/oauth2/token`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                  Accept: "application/json",
                },
                body: new URLSearchParams({
                  grant_type: "refresh_token",
                  refresh_token: refreshToken,
                  client_id: clientId,
                  client_secret: clientSecret,
                }),
              },
            );

            if (!response.ok) {
              log.error("Token refresh failed: OAuth2 error", {
                status: response.status,
                network,
              });
              await get().logout();
              return;
            }

            const data = (await response.json()) as JwtResponse;
            if (!data?.id_token) {
              log.error("Token refresh failed: no id_token in response");
              await get().logout();
              return;
            }

            if (isWeb()) {
              const prev = get().user;
              const decoded = decodeJwt(data.id_token) as IdTokenClaims;
              const newUser = new User({
                id_token: data.id_token,
                access_token: data.access_token,
                token_type: data.token_type ?? "Bearer",
                scope:
                  data.scope ??
                  (typeof prev?.scope === "string" ? prev.scope : undefined) ??
                  "openid email profile offline_access",
                refresh_token: data.refresh_token ?? prev?.refresh_token,
                profile: {
                  ...(prev?.profile ?? {}),
                  ...decoded,
                } as User["profile"],
                expires_at: resolveExpiresAt(data),
              });
              await getUserManagerInstance().storeUser(newUser);
              set({ user: newUser });
            } else {
              await storeJwt(data, network);
            }
            await clearZkLoginJwtForNetwork(network);
            log.debug("Primary OAuth JWT refreshed", { network });
          } catch (error) {
            log.error("Token refresh failed: unexpected error", {
              network,
              error,
            });
            await get().logout();
          }
        },

        logout: async () => {
          try {
            await getUserManagerInstance().removeUser();
            await performFullCleanup();

            // Clear JWTs and user state
            await clearAllJwts();
            clearZkLoginAddressCache();
            set({ user: null });

            // Clear zkProofs first (separate from ephemeral key)
            await zkProofService.clear();

            // Lock vault (clears ephemeral key) but preserve device data
            // User just needs to re-authenticate, keys should persist across logouts
            // Use deviceStore.lock() to ensure isLocked state is updated
            await useDeviceStore.getState().lock();

            const tenant = getCurrentTenantId();

            // Build logout URL manually to avoid CORS issues with OIDC discovery
            const fusionAuthUrl = getTenantConfig(tenant).serverUrl;
            const clientId = getTenantConfig(tenant).clientId;

            if (isExtension() && typeof chrome !== "undefined") {
              // Extensions use chrome.identity.launchWebAuthFlow to trigger OIDC logout
              const redirectUri = chrome.identity.getRedirectURL();

              const logoutUrl = new URL(
                `${fusionAuthUrl.replace(/\/$/, "")}/oauth2/logout`,
              );
              logoutUrl.searchParams.set("client_id", clientId);
              logoutUrl.searchParams.set(
                "post_logout_redirect_uri",
                redirectUri,
              );

              chrome.identity.launchWebAuthFlow(
                { url: logoutUrl.toString(), interactive: true },
                async () => {
                  chrome.runtime.sendMessage({
                    __from: "Eve Vault",
                    event: "change",
                    payload: { accounts: [] },
                  });
                },
              );
            } else {
              // For web, just redirect to home - FusionAuth session can remain
              // (user will re-authenticate to get new JWT with correct network params)
              // Note: If full FusionAuth logout is needed, configure post_logout_redirect_uri
              // in FusionAuth OAuth settings
              window.location.href = window.location.origin;
            }
          } catch (error) {
            log.error("Error during logout cleanup", error);
            set({
              user: null,
              error: error instanceof Error ? error.message : "Unknown error",
            });

            // Fallback: redirect so user is not stuck
            redirectToFusionAuthLogout();
          }
        },
      };
    },
    {
      name: AUTH_STORAGE_KEY,
      storage: createJSONStorage(() =>
        isWeb() ? localStorageAdapter : chromeStorageAdapter,
      ),
      onRehydrateStorage: () => {
        return async (state, error) => {
          if (error) {
            log.error("Error rehydrating auth store", error);
            return;
          }

          if (state) {
            log.debug("Rehydrated auth store", state);
          }
        };
      },
    },
  ),
);

/**
 * Clears auth state for the given tenant (no redirect).
 * Used when switching server so the next login uses the new tenant.
 */
export async function runTenantSwitchCleanup(
  tenantId: TenantId,
): Promise<void> {
  // TODO: Do not clean up PIN, maintain existing ephemeral key and nonce for network
  try {
    await getUserManager(tenantId).removeUser();
    await performFullCleanup();
    await clearAllJwts();
    clearZkLoginAddressCache();
    useAuthStore.getState().setUser(null);
    await zkProofService.clear();
    await useDeviceStore.getState().lock();
  } catch (error) {
    log.error("Error during tenant switch cleanup", error);
  }
}

/**
 * Clears auth state for current tenant and redirects to app home with new tenant.
 * Used when switching server (tenant) via dev dropdown.
 */
export async function switchTenantAndReload(
  newTenantId: TenantId,
): Promise<void> {
  const current = getCurrentTenantId();
  if (current === newTenantId) return;

  await runTenantSwitchCleanup(current);
  await setCurrentTenantId(newTenantId as TenantId);

  if (isWeb() && typeof window !== "undefined") {
    const url =
      newTenantId === DEFAULT_TENANT_ID
        ? window.location.origin
        : `${window.location.origin}?tenant=${newTenantId}`;
    window.location.href = url;
  }
}

export const waitForAuthHydration = async () => {
  if (useAuthStore.persist.hasHydrated()) {
    return;
  }

  await new Promise<void>((resolve) => {
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
    useAuthStore.persist.rehydrate();
  });
};

// Set up event listeners outside the store (lazy initialization to avoid module load order issues)
let eventListenersInitialized = false;

function initializeEventListeners() {
  if (eventListenersInitialized) return;
  eventListenersInitialized = true;
  // Ensure current tenant's UserManager is created (handlers are registered in authConfig)
  getUserManager(getCurrentTenantId());
}

if (typeof window !== "undefined") {
  queueMicrotask(initializeEventListeners);
}
