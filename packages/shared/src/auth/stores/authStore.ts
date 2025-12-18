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
import { chromeStorageAdapter, localStorageAdapter } from "../../adapters";
import { zkProofService } from "../../services/keeperService";
import { useDeviceStore } from "../../stores/deviceStore";
import { useNetworkStore } from "../../stores/networkStore";
import type { AuthMessage, TokenResponse } from "../../types";
import { getUserManager } from "../authConfig";
import { getZkLoginAddress } from "../enoki";
import { clearToken, storeToken } from "../storageService";
import type { AuthState } from "../types";
import { vendJwt } from "../vendToken";

declare const chrome: any;

const log = createLogger();

export const getEnokiApiKey = (): string => {
  if (isBrowser()) {
    const env = (import.meta as unknown as { env: Record<string, string> }).env;
    return env?.VITE_ENOKI_API_KEY ?? "";
  }
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
              const { "evevault:jwt": allNetworkTokens } = await new Promise<{
                "evevault:jwt"?: Record<SuiChain, TokenResponse>;
              }>((resolve) => {
                chrome.storage.local.get(
                  "evevault:jwt",
                  (items: {
                    "evevault:jwt"?: Record<SuiChain, TokenResponse>;
                  }) => resolve(items),
                );
              });

              const network = useNetworkStore.getState().chain;
              const idToken = allNetworkTokens?.[network]?.id_token;
              const token = allNetworkTokens?.[network];

              if (token && idToken) {
                log.info("Found token in chrome.storage, loading user");
                const currentUser = await userManager.getUser();
                if (!currentUser) {
                  log.info("Loading user from chrome storage token");
                  const decodedToken = decodeJwt(idToken);

                  // Log nonce comparison
                  const deviceStore = useDeviceStore.getState();
                  const deviceNonce = deviceStore.networkData[network]?.nonce;
                  const jwtNonce = decodedToken.nonce as string | undefined;

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
                    id_token: token.id_token,
                    access_token: token.access_token,
                    token_type: token.token_type,
                    scope: token.scope,
                    profile: {
                      ...(decodedToken as IdTokenClaims),
                      sui_address: address,
                      salt,
                    },
                    expires_at:
                      Math.floor(Date.now() / 1000) + token.expires_at!,
                  });
                  await userManager.storeUser(newUser);
                  set({ user: newUser, loading: false });
                  return; // Exit early after setting user
                } else {
                  // No token found for this network
                  // Don't set user to null if we already have a user - it might be from another network
                  // and we're in the process of refreshing
                  const currentUser = get().user;
                  if (!currentUser) {
                    log.info("No token found in storage and no existing user");
                    set({ user: null, loading: false });
                  } else {
                    log.info(
                      "No token found for this network, keeping existing user",
                    );
                    set({ loading: false });
                  }
                }

                // Fallback for non-extension context
                const user = await userManager.getUser();
                set({ user, loading: false });
              }

              // If we get here, there are no tokens for this network
              // This means we need to login again
              set({ loading: false });
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
              const token = await get().extensionLogin();
              if (token) {
                const decodedToken = decodeJwt<IdTokenClaims>(
                  token.id_token as string,
                );

                // Log nonce comparison
                const deviceStore = useDeviceStore.getState();
                const network = useNetworkStore.getState().chain;
                const deviceNonce = deviceStore.networkData[network]?.nonce;
                const jwtNonce = decodedToken.nonce as string | undefined;

                log.debug("Nonce comparison during extension login", {
                  jwtNonce,
                  deviceNonce,
                  matches: jwtNonce === deviceNonce,
                });

                const zkLoginResponse = await getZkLoginAddress({
                  jwt: token.id_token,
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
                  id_token: token.id_token,
                  access_token: token.access_token,
                  token_type: token.token_type,
                  scope: token.scope,
                  profile: {
                    ...(decodedToken as IdTokenClaims),
                    sui_address: address,
                    salt,
                  },
                  expires_at: Math.floor(Date.now() / 1000) + token.expires_in,
                });

                await userManager.storeUser(user);
                set({ user });
                return user as User;
              }
            } catch (error) {
              log.error("Extension login failed", error);
              if (
                (error as any)?.message !== "The user did not approve access."
              ) {
                set({
                  error:
                    error instanceof Error ? error.message : "Unknown error",
                });
              }
            }
          } else {
            const getDeviceParams = () => {
              const deviceStore = useDeviceStore.getState();
              const { jwtRandomness } = deviceStore;

              const networkData = deviceStore.networkData[network];

              if (!networkData) {
                throw new Error("Network data not found");
              }

              const { nonce, maxEpoch } = networkData;

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
          // 1. Get existing token
          const { "evevault:jwt": allNetworkTokens } = await new Promise<{
            "evevault:jwt"?: Record<SuiChain, TokenResponse>;
          }>((resolve) => {
            chrome.storage.local.get(
              "evevault:jwt",
              (items: { "evevault:jwt"?: Record<SuiChain, TokenResponse> }) =>
                resolve(items),
            );
          });

          const existingToken = allNetworkTokens?.[network];
          if (!existingToken?.id_token) {
            console.info(`No idToken found for network ${network}`);
          }

          // If no existing token for this chain, fallback to any available token
          const targetToken =
            existingToken ??
            allNetworkTokens?.[Object.keys(allNetworkTokens)[0] as SuiChain];

          if (!targetToken) {
            throw new Error(`No token or fallback found in storage`);
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
          const vendResult = await vendJwt(targetToken.id_token, {
            nonce,
            jwtRandomness,
            maxEpoch: maxEpoch.toString(),
          });

          // 5. Validate nonce in returned JWT
          const newIdToken = decodeJwt<IdTokenClaims>(vendResult as string);
          const jwtNonce = newIdToken.nonce;

          console.log("=== NONCE VALIDATION ===");
          console.log("Nonce sent in request:", nonce);
          console.log("Nonce in returned JWT:", jwtNonce);
          console.log("Nonces match:", jwtNonce === nonce);
          console.log("========================");

          if (jwtNonce !== nonce) {
            throw new Error(
              `Nonce mismatch: Expected ${nonce}, but JWT contains ${jwtNonce}. `,
            );
          }

          // 6. Construct new token response
          const newToken: TokenResponse = {
            id_token: vendResult,
            access_token: vendResult,
            token_type: "Bearer",
            expires_in: newIdToken.exp
              ? newIdToken.exp - Math.floor(Date.now() / 1000)
              : 3600,
            scope: "openid email profile",
          };

          // 7. Store the new token, replacing the previous one
          await storeToken(newToken, network);

          // 8. Update existing user with new token (preserve profile, address, salt, etc.)
          const currentUser = get().user;
          if (currentUser) {
            const updatedUser = new User({
              ...currentUser,
              id_token: newToken.id_token,
              access_token: newToken.access_token,
              expires_at: Math.floor(Date.now() / 1000) + newToken.expires_in,
            });

            await userManager.storeUser(updatedUser);
            get().setUser(updatedUser);
          } else {
            console.warn("No existing user found to update");
          }
        },

        logout: async () => {
          try {
            await userManager.removeUser();
            await performFullCleanup();
            await zkProofService.clear();

            const network = useNetworkStore.getState().chain;

            useDeviceStore.getState().reset();
            await useDeviceStore.getState().initializeForChain(network);

            if (isExtension() && typeof chrome !== "undefined") {
              // Extensions use chrome.identity.launchWebAuthFlow to trigger OIDC logout
              const fusionAuthUrl = import.meta.env.VITE_FUSION_SERVER_URL;
              const clientId = import.meta.env.VITE_FUSIONAUTH_CLIENT_ID;
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
                  await clearToken();

                  chrome.runtime.sendMessage({
                    __from: "Eve Vault",
                    event: "change",
                    payload: { accounts: [] },
                  });

                  set({ user: null });
                },
              );
            } else {
              // For web, use standard OIDC signout redirect
              await userManager.signoutRedirect();
              set({ user: null });
            }
          } catch (error) {
            log.error("Error during logout cleanup", error);
            set({
              error: error instanceof Error ? error.message : "Unknown error",
            });

            // Fallback: try signout redirect even if there was an error
            if (!isExtension()) {
              userManager.signoutRedirect();
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
