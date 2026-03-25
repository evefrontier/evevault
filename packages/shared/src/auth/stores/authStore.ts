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
import type { AuthMessage, OAuthTokenResponse, TenantId } from "../../types";
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
import { parseOAuthTokenResponse } from "../oauthTokenResponse";
import {
  clearAllJwts,
  clearZkLoginJwtForNetwork,
  getJwtForNetwork,
  storeJwt,
} from "../storageService";
import type { AuthState, RefreshJwtOptions } from "../types";
import { userToJwtResponse } from "../userToJwtResponse";
import {
  resolveExpiresAt,
  resolveExpiresAtFromOAuthResponse,
} from "../utils/authStoreUtils";

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

      async function enrichUserWithZkLoginIfNeeded(user: User): Promise<User> {
        const idToken = user.id_token;
        if (!idToken) {
          return user;
        }

        const sui = user.profile?.sui_address;
        if (typeof sui === "string" && sui.trim()) {
          return user;
        }

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
        const decodedJwt = decodeJwt(idToken) as IdTokenClaims;

        return new User({
          ...user,
          profile: {
            ...(typeof user.profile === "object" && user.profile !== null
              ? user.profile
              : {}),
            ...decodedJwt,
            sui_address: address,
            salt,
          } as User["profile"],
        });
      }

      async function syncPrimaryJwtFromUser(
        user: User,
        chain: SuiChain,
      ): Promise<void> {
        const jwt = userToJwtResponse(user);
        if (!jwt?.refresh_token?.trim()) {
          log.warn(
            "syncPrimaryJwtFromUser: no refresh token, skipping evevault:jwt mirror",
            { chain },
          );
          return;
        }
        await storeJwt(jwt as OAuthTokenResponse, chain);
      }

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
              let user = await getUserManagerInstance().getUser();

              if (!user?.id_token) {
                log.info("Extension init: no OIDC user in UserManager", {
                  network,
                });
                set({ user: null, loading: false });
                return;
              }

              const jwtSnapshot = userToJwtResponse(user);
              if (jwtSnapshot) {
                const expiresAt = resolveExpiresAt(jwtSnapshot);
                const now = Math.floor(Date.now() / 1000);

                if (now >= expiresAt) {
                  if (!user.refresh_token?.trim()) {
                    log.info(
                      "Extension init: JWT expired, no refresh token; clearing user",
                      {
                        network,
                        expiresAt,
                        now,
                      },
                    );
                    set({ user: null, loading: false });
                    return;
                  }

                  log.info("Extension init: JWT expired, attempting refresh", {
                    network,
                    expiresAt,
                    now,
                  });
                  user = await getUserManagerInstance().getUser();

                  if (!user?.id_token) {
                    set({ user: null, loading: false });
                    return;
                  }

                  const after = userToJwtResponse(user);
                  if (after) {
                    const expAfter = resolveExpiresAt(after);
                    const nowAfter = Math.floor(Date.now() / 1000);
                    if (nowAfter >= expAfter) {
                      log.info(
                        "Extension init: JWT still expired after refresh",
                        {
                          network,
                        },
                      );
                      set({ user: null, loading: false });
                      return;
                    }
                  }
                }
              }

              user = await enrichUserWithZkLoginIfNeeded(user);
              await getUserManagerInstance().storeUser(user);
              await syncPrimaryJwtFromUser(user, network);
              set({ user, loading: false });
              return;
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

                let user = new User({
                  id_token: jwtResponse.id_token,
                  access_token: jwtResponse.access_token,
                  token_type: jwtResponse.token_type,
                  scope: jwtResponse.scope,
                  refresh_token: jwtResponse.refresh_token,
                  profile: {
                    ...(decodedJwt as IdTokenClaims),
                  } as User["profile"],
                  expires_at:
                    Math.floor(Date.now() / 1000) + jwtResponse.expires_in,
                });

                user = await enrichUserWithZkLoginIfNeeded(user);
                await getUserManagerInstance().storeUser(user);
                await syncPrimaryJwtFromUser(user, network);
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

        refreshJwt: async (network: SuiChain, options?: RefreshJwtOptions) => {
          const logoutOnFailure = options?.logoutOnFailure !== false;
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

            let refreshToken = existingJwt?.refresh_token;
            if (isExtension()) {
              const um = await getUserManagerInstance().getUser();
              if (um?.refresh_token?.trim()) {
                refreshToken = um.refresh_token;
              }
            }

            if (!refreshToken?.trim()) {
              log.error("Token refresh failed: no refresh token");
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
              return;
            }

            let data: OAuthTokenResponse;
            try {
              data = parseOAuthTokenResponse(await response.json());
            } catch (parseError) {
              log.error("Token refresh failed: invalid token response", {
                network,
                parseError,
              });
              return;
            }

            if (isWeb()) {
              const prev = get().user;
              const decoded = decodeJwt(data.id_token) as IdTokenClaims;
              let newUser = new User({
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
                expires_at: resolveExpiresAtFromOAuthResponse(data),
              });
              newUser = await enrichUserWithZkLoginIfNeeded(newUser);
              await getUserManagerInstance().storeUser(newUser);
              set({ user: newUser });
            } else {
              const prev = await getUserManagerInstance().getUser();
              const decoded = decodeJwt(data.id_token) as IdTokenClaims;
              let newUser = new User({
                id_token: data.id_token,
                access_token: data.access_token,
                token_type: data.token_type ?? "Bearer",
                scope: data.scope ?? "openid email profile offline_access",
                refresh_token: data.refresh_token,
                profile: {
                  ...(prev?.profile ?? {}),
                  ...decoded,
                } as User["profile"],
                expires_at: resolveExpiresAtFromOAuthResponse(data),
              });
              newUser = await enrichUserWithZkLoginIfNeeded(newUser);
              await getUserManagerInstance().storeUser(newUser);
              set({ user: newUser });
              await syncPrimaryJwtFromUser(newUser, network);
            }
            await clearZkLoginJwtForNetwork(network);
            log.debug("Primary OAuth JWT refreshed", { network });
          } catch (error) {
            log.error("Token refresh failed: unexpected error", {
              network,
              error,
            });
            if (logoutOnFailure) {
              await get().logout();
            }
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
