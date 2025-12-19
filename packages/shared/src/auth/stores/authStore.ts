import {
  chromeStorageAdapter,
  localStorageAdapter,
} from "@evevault/shared/adapters";
import {
  type AuthState,
  getZkLoginAddress,
  vendJwt,
} from "@evevault/shared/auth";
import { useDeviceStore, useNetworkStore } from "@evevault/shared/stores";
import type { AuthMessage, JwtResponse } from "@evevault/shared/types";
import {
  createLogger,
  getDeviceData,
  isBrowser,
  isExtension,
  isWeb,
  performFullCleanup,
} from "@evevault/shared/utils";
import type { SuiChain } from "@mysten/wallet-standard";
import { decodeJwt } from "jose";
import { type IdTokenClaims, User } from "oidc-client-ts";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { ephKeyService, zkProofService } from "../../services/vaultService";
import { getUserManager } from "../authConfig";
import { clearAllJwts, storeJwt } from "../storageService";
import { resolveExpiresAt } from "../utils/authStoreUtils";

// biome-ignore lint/suspicious/noExplicitAny: Chrome extension API types are not available in shared package
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
      const userManager = getUserManager();

      return {
        user: null,
        loading: false,
        error: null,

        initialize: async () => {
          set({ loading: true });
          try {
            if (isExtension() && typeof chrome !== "undefined") {
              const network = useNetworkStore.getState().chain;

              // Use getJwtForNetwork instead of reading chrome.storage directly
              // This ensures we use the same logic as hasJwtForNetwork and avoid race conditions
              const { getJwtForNetwork } = await import("../storageService");
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
                const currentUser = await userManager.getUser();
                if (!currentUser) {
                  log.info("Loading user from chrome storage JWT");
                  const decodedJwt = decodeJwt(idToken);

                  // Log nonce comparison
                  const deviceStore = useDeviceStore.getState();
                  const deviceNonce = deviceStore.networkData[network]?.nonce;
                  const jwtNonce = decodedJwt.nonce as string | undefined;

                  log.debug("Nonce comparison during initialize", {
                    network,
                    jwtNonce,
                    deviceNonce,
                    matches: jwtNonce === deviceNonce,
                  });

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
                    profile: {
                      ...(decodedJwt as IdTokenClaims),
                      sui_address: address,
                      salt,
                    },
                    expires_at:
                      Math.floor(Date.now() / 1000) +
                      (storedJwt.expires_at ?? 3600),
                  });
                  await userManager.storeUser(newUser);
                  set({ user: newUser, loading: false });
                  return; // Exit early after setting user
                }

                // Fallback for non-extension context
                const user = await userManager.getUser();
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

          if (isExtension()) {
            try {
              const jwtResponse = await get().extensionLogin();
              if (jwtResponse) {
                const decodedJwt = decodeJwt<IdTokenClaims>(
                  jwtResponse.id_token as string,
                );

                // Log nonce comparison
                const deviceStore = useDeviceStore.getState();
                const network = useNetworkStore.getState().chain;
                const deviceNonce = deviceStore.networkData[network]?.nonce;
                const jwtNonce = decodedJwt.nonce as string | undefined;

                log.debug("Nonce comparison during extension login", {
                  jwtNonce,
                  deviceNonce,
                  matches: jwtNonce === deviceNonce,
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
                  profile: {
                    ...(decodedJwt as IdTokenClaims),
                    sui_address: address,
                    salt,
                  },
                  expires_at:
                    Math.floor(Date.now() / 1000) + jwtResponse.expires_in,
                });

                await userManager.storeUser(user);
                set({ user });

                return user as User;
              }
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

            userManager.signinRedirect({
              nonce: getDeviceParams().nonce,
              extraQueryParams: {
                jwtRandomness: getDeviceParams().jwtRandomness,
                maxEpoch: getDeviceParams().maxEpoch,
              },
            });
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
            });
          });
        },

        refreshJwt: async (network: SuiChain) => {
          // 1. Get existing JWT
          const { "evevault:jwt": allNetworkJwts } = await new Promise<{
            "evevault:jwt"?: Record<SuiChain, JwtResponse>;
          }>((resolve) => {
            chrome.storage.local.get(
              "evevault:jwt",
              (items: { "evevault:jwt"?: Record<SuiChain, JwtResponse> }) =>
                resolve(items),
            );
          });

          const existingJwt = allNetworkJwts?.[network];
          if (!existingJwt?.id_token) {
            log.info(`No idToken found for network ${network}`);
          }

          // If no existing JWT for this chain, fallback to any available JWT
          const targetJwt =
            existingJwt ??
            allNetworkJwts?.[Object.keys(allNetworkJwts)[0] as SuiChain];

          if (!targetJwt) {
            throw new Error(`No JWT or fallback found in storage`);
          }

          // 2. Refresh device parameters (nonce, maxEpoch)
          await useDeviceStore.getState().initializeForChain(network);

          // 3. Get updated device parameters (reads from store first, falls back to storage if needed)
          const { jwtRandomness, nonce, maxEpoch } =
            await getDeviceData(network);

          if (!nonce || !jwtRandomness || !maxEpoch) {
            throw new Error(
              `Device data not initialized for network ${network}. Missing: ${
                !nonce ? "nonce" : ""
              } ${!jwtRandomness ? "jwtRandomness" : ""} ${
                !maxEpoch ? "maxEpoch" : ""
              }`,
            );
          }

          // 4. Vend new JWT with updated parameters
          const vendResult = await vendJwt(targetJwt.id_token, {
            nonce,
            jwtRandomness,
            maxEpoch: maxEpoch.toString(),
          });

          // 5. Validate nonce in returned JWT
          const newIdToken = decodeJwt<IdTokenClaims>(vendResult as string);
          const jwtNonce = newIdToken.nonce;

          log.debug("Nonce validation", {
            nonceSent: nonce,
            nonceInJwt: jwtNonce,
            noncesMatch: jwtNonce === nonce,
          });

          if (jwtNonce !== nonce) {
            throw new Error(
              `Nonce mismatch: Expected ${nonce}, but JWT contains ${jwtNonce}. `,
            );
          }

          // 6. Construct new JWT response
          const newJwt: JwtResponse = {
            id_token: vendResult,
            access_token: vendResult,
            token_type: "Bearer",
            expires_in: newIdToken.exp
              ? newIdToken.exp - Math.floor(Date.now() / 1000)
              : 3600,
            scope: "openid email profile",
          };

          // 7. Store the new JWT, replacing the previous one
          await storeJwt(newJwt, network);

          // 8. Update existing user with new JWT (preserve profile, address, salt, etc.)
          const currentUser = get().user;
          if (currentUser) {
            const updatedUser = new User({
              ...currentUser,
              id_token: newJwt.id_token,
              access_token: newJwt.access_token,
              expires_at: Math.floor(Date.now() / 1000) + newJwt.expires_in,
            });

            await userManager.storeUser(updatedUser);
            get().setUser(updatedUser);
          } else {
            log.warn("No existing user found to update");
          }
        },

        logout: async () => {
          try {
            await userManager.removeUser();
            await performFullCleanup();

            // Clear JWTs and user state
            await clearAllJwts();
            set({ user: null });

            // Clear zkProofs first (separate from ephemeral key)
            await zkProofService.clear();

            // Lock vault (clears ephemeral key) but preserve device data
            // User just needs to re-authenticate, keys should persist across logouts
            await ephKeyService.lock();

            // Build logout URL manually to avoid CORS issues with OIDC discovery
            const fusionAuthUrl = import.meta.env.VITE_FUSION_SERVER_URL;
            const clientId = import.meta.env.VITE_FUSIONAUTH_CLIENT_ID;

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

            // Fallback: redirect to home if there was an error
            if (!isExtension() && typeof window !== "undefined") {
              window.location.href = window.location.origin;
            }
          }
        },
      };
    },
    {
      name: "evevault:auth",
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

// Set up event listeners outside the store
const userManager = getUserManager();

userManager.events.addUserLoaded((user) => {
  useAuthStore.getState().setUser(user);
});

userManager.events.addUserUnloaded(() => {
  useAuthStore.getState().setUser(null);
});
