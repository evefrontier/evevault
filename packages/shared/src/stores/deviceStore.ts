import type { PublicKey } from "@mysten/sui/cryptography";
import { Ed25519PublicKey } from "@mysten/sui/keypairs/ed25519";
import { Secp256r1PublicKey } from "@mysten/sui/keypairs/secp256r1";
import { generateNonce, generateRandomness } from "@mysten/sui/zklogin";
import {
  SUI_DEVNET_CHAIN,
  SUI_LOCALNET_CHAIN,
  SUI_MAINNET_CHAIN,
  SUI_TESTNET_CHAIN,
  type SuiChain,
} from "@mysten/wallet-standard";
import { decodeJwt } from "jose";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { chromeStorageAdapter, localStorageAdapter } from "../adapters";
import { useAuthStore } from "../auth";
import { hasJwtForNetwork } from "../auth/storageService";
import { ephKeyService, zkProofService } from "../services/vaultService";
import { createSuiClient } from "../sui";
import {
  type DeviceState,
  type HashedData,
  KEY_FLAG_ED25519,
  KEY_FLAG_SECP256R1,
  type NetworkDataEntry,
  type PersistedDeviceStore,
  type PersistedDeviceStoreState,
  type StoredSecretKey,
  type ZkProofResponse,
} from "../types";
import { createLogger, encrypt } from "../utils";
import { isWeb } from "../utils/environment";
import { createWebCryptoPlaceholder, fetchZkProof } from "../wallet";
import { useNetworkStore } from "./networkStore";

const log = createLogger();

const isHashedSecretKey = (value: unknown): value is HashedData => {
  if (
    typeof value !== "object" ||
    value === null ||
    !("iv" in value) ||
    !("data" in value)
  ) {
    return false;
  }

  const candidate = value as { iv?: unknown; data?: unknown };
  return typeof candidate.iv === "string" && typeof candidate.data === "string";
};

const resolveStoredSecretKey = async (
  value: unknown,
  pin: string,
): Promise<StoredSecretKey> => {
  if (!value) {
    return null;
  }

  if (isHashedSecretKey(value)) {
    return value;
  }

  if (typeof value === "string") {
    return encrypt(value, pin);
  }

  return null;
};

const createEmptyNetworkDataEntry = (): NetworkDataEntry => ({
  nonce: null,
  maxEpoch: null,
  maxEpochTimestampMs: null,
  jwtRandomness: null,
});

/**
 * Reconstructs a PublicKey from stored bytes and flag
 */
const reconstructPublicKey = (
  bytes: number[],
  flag: number | null,
): PublicKey | null => {
  try {
    const keyBytes = new Uint8Array(bytes);

    // Determine key type from flag or default based on platform
    const keyFlag = flag ?? (isWeb() ? KEY_FLAG_SECP256R1 : KEY_FLAG_ED25519);

    if (keyFlag === KEY_FLAG_SECP256R1) {
      return new Secp256r1PublicKey(keyBytes);
    } else {
      return new Ed25519PublicKey(keyBytes);
    }
  } catch (error) {
    log.error("Error reconstructing public key", error);
    return null;
  }
};

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set, get) => ({
      isLocked: true,
      ephemeralPublicKey: null,
      ephemeralPublicKeyBytes: null,
      ephemeralPublicKeyFlag: null,
      ephemeralKeyPairSecretKey: null,
      networkData: {
        [SUI_DEVNET_CHAIN]: createEmptyNetworkDataEntry(),
        [SUI_TESTNET_CHAIN]: createEmptyNetworkDataEntry(),
        [SUI_LOCALNET_CHAIN]: createEmptyNetworkDataEntry(),
        [SUI_MAINNET_CHAIN]: createEmptyNetworkDataEntry(),
      },
      loading: false,
      error: null,

      // Network-aware getters
      getMaxEpoch: (chain?: SuiChain) => {
        const currentChain = chain || useNetworkStore.getState().chain;
        return get().networkData[currentChain]?.maxEpoch ?? null;
      },

      getMaxEpochTimestampMs: (chain?: SuiChain) => {
        const currentChain = chain || useNetworkStore.getState().chain;
        return get().networkData[currentChain]?.maxEpochTimestampMs ?? null;
      },

      getNonce: (chain?: SuiChain) => {
        const currentChain = chain || useNetworkStore.getState().chain;
        return get().networkData[currentChain]?.nonce ?? null;
      },

      getJwtRandomness: (chain?: SuiChain) => {
        const currentChain = chain || useNetworkStore.getState().chain;
        return get().networkData[currentChain]?.jwtRandomness ?? null;
      },

      // Initialize device state
      initialize: async (pin: string) => {
        set({ loading: true });

        // PIN is required for both web and extension
        if (!pin || pin.trim().length === 0) {
          set({
            error: "PIN is required",
            loading: false,
          });
          return;
        }

        const currentState = get();
        const currentChain = useNetworkStore.getState().chain;

        const networkDataEntry = currentState.networkData[currentChain];
        const {
          maxEpoch,
          nonce,
          maxEpochTimestampMs,
          jwtRandomness: networkJwtRandomness,
        } = networkDataEntry ?? {
          maxEpoch: null,
          nonce: null,
          maxEpochTimestampMs: null,
          jwtRandomness: null,
        };
        const { networkData, ephemeralKeyPairSecretKey } = currentState;
        let jwtRandomness = networkJwtRandomness;

        try {
          // Initialize the ephKeyService (needed for web to recover from IndexedDB)
          await ephKeyService.initialize();

          // For web, check if we already have a keypair in IndexedDB
          if (isWeb()) {
            const hasExistingKeypair = await ephKeyService.hasKeypair();

            if (hasExistingKeypair) {
              log.info("[web] Found existing encrypted keypair in IndexedDB");

              // Unlock the vault with PIN to decrypt the keypair
              const publicKey = await ephKeyService.unlockVault(null, pin);

              if (publicKey) {
                set({
                  ephemeralPublicKey: publicKey,
                  ephemeralPublicKeyBytes: Array.from(publicKey.toRawBytes()),
                  ephemeralPublicKeyFlag: publicKey.flag(),
                  ephemeralKeyPairSecretKey: createWebCryptoPlaceholder(),
                });

                // Check if we need to initialize for chain
                // BUT: Only regenerate if we don't have a JWT with matching nonce
                // (regenerating would cause nonce mismatch)
                if (!nonce || !maxEpoch || !maxEpochTimestampMs) {
                  // Check if we have a JWT for this network
                  const hasJwt = await hasJwtForNetwork(currentChain);
                  if (hasJwt) {
                    // Dynamic import to avoid circular dependency: deviceStore → auth → authStore → deviceStore
                    const { getJwtForNetwork } = await import(
                      "../auth/storageService"
                    );
                    const jwt = await getJwtForNetwork(currentChain);
                    if (jwt?.id_token) {
                      try {
                        const decodedJwt = decodeJwt(jwt.id_token);
                        const jwtNonce = decodedJwt.nonce as string | undefined;
                        // If JWT exists but device data is missing, we can't regenerate
                        // (would cause nonce mismatch). User needs to re-login.
                        if (jwtNonce) {
                          log.warn(
                            "Device data missing but JWT exists - cannot regenerate without causing nonce mismatch",
                            {
                              chain: currentChain,
                              jwtNonce,
                            },
                          );
                          // Don't regenerate - user will need to re-login
                          set({ loading: false, isLocked: false });
                          return;
                        }
                      } catch (error) {
                        log.warn("Failed to decode JWT for nonce check", error);
                      }
                    }
                  }
                  // No JWT or nonce check failed - safe to regenerate
                  await get().initializeForChain(currentChain);
                  set({ loading: false, isLocked: false });
                } else {
                  set({ loading: false, isLocked: false });
                }
                return;
              }
            }

            // No existing keypair, create new one with PIN encryption
            log.info(
              "[web] Creating new Secp256r1 keypair (encrypted with PIN)",
            );
            const { publicKey } =
              await ephKeyService.createEphemeralKeyPair(pin);

            set({
              ephemeralPublicKey: publicKey,
              ephemeralPublicKeyBytes: Array.from(publicKey.toRawBytes()),
              ephemeralPublicKeyFlag: publicKey.flag(),
              // Web uses placeholder for secret key (actual key is encrypted in IndexedDB)
              ephemeralKeyPairSecretKey: createWebCryptoPlaceholder(),
            });

            // For new keypair creation, always initialize device data
            // (no JWT exists yet, so no risk of nonce mismatch)
            await get().initializeForChain(currentChain);
            set({ loading: false, isLocked: false });
            return;
          }

          // Extension flow (Ed25519)
          const normalizedCurrentSecretKey = await resolveStoredSecretKey(
            currentState.ephemeralKeyPairSecretKey,
            pin,
          );
          let storedSecretKey: StoredSecretKey = normalizedCurrentSecretKey;

          // Don't reinitialize if we already have data
          if (
            jwtRandomness &&
            maxEpoch !== null &&
            nonce !== null &&
            maxEpochTimestampMs !== null &&
            storedSecretKey
          ) {
            log.debug("Device store already initialized, skipping re-init");
            set({ loading: false });
            return;
          }

          // Check if we already have device data persisted
          if (
            !jwtRandomness ||
            !maxEpoch ||
            !nonce ||
            !maxEpochTimestampMs ||
            !storedSecretKey
          ) {
            const persistedDeviceStore = await new Promise<unknown>(
              (resolve) => {
                chrome.storage.local.get(["evevault:device"], (result) => {
                  resolve(result["evevault:device"] || null);
                });
              },
            );

            if (persistedDeviceStore) {
              try {
                let persistedDeviceStoreState: PersistedDeviceStoreState | null =
                  null;
                if (typeof persistedDeviceStore === "string") {
                  persistedDeviceStoreState =
                    (JSON.parse(persistedDeviceStore) as PersistedDeviceStore)
                      .state ?? null;
                } else if (
                  typeof persistedDeviceStore === "object" &&
                  persistedDeviceStore !== null &&
                  "state" in persistedDeviceStore
                ) {
                  persistedDeviceStoreState =
                    (persistedDeviceStore as PersistedDeviceStore).state ??
                    null;
                }

                if (persistedDeviceStoreState) {
                  const persistedNetworkData =
                    persistedDeviceStoreState.networkData?.[currentChain];
                  const persistedJwtRandomness =
                    persistedNetworkData?.jwtRandomness ?? null;
                  jwtRandomness = persistedJwtRandomness;
                  storedSecretKey = await resolveStoredSecretKey(
                    persistedDeviceStoreState.ephemeralKeyPairSecretKey ??
                      storedSecretKey,
                    pin,
                  );

                  if (jwtRandomness && storedSecretKey) {
                    log.debug("Rehydrating device store from persisted data");

                    set({
                      ephemeralKeyPairSecretKey: storedSecretKey,
                      networkData:
                        persistedDeviceStoreState.networkData ?? networkData,
                      loading: false,
                      error: null,
                    });
                    return;
                  }
                }
              } catch (parseError) {
                log.error("Error parsing persisted device store", parseError);
              }
            }
          }

          // Check if we need to create a new ephemeral key pair
          const needsNewKeyPair =
            !storedSecretKey || !ephemeralKeyPairSecretKey;

          if (needsNewKeyPair) {
            log.info("No existing ephemeral key pair found, creating new one");

            // Create new ephemeral key pair first
            const { hashedSecretKey, publicKey } =
              await ephKeyService.createEphemeralKeyPair(pin);

            if (!hashedSecretKey || !publicKey) {
              throw new Error("Failed to create ephemeral key pair");
            }

            log.debug("Created new ephemeral key pair");
            set({
              ephemeralPublicKey: publicKey,
              ephemeralPublicKeyBytes: Array.from(publicKey.toRawBytes()),
              ephemeralPublicKeyFlag: publicKey.flag(),
              ephemeralKeyPairSecretKey: hashedSecretKey,
            });
          } else {
            // We have an existing key, unlock the vault with it
            log.info("Existing ephemeral key pair found, unlocking vault");

            await ephKeyService.unlockVault(storedSecretKey, pin);

            // Refresh the public key after unlocking
            const refreshedPublicKey =
              await ephKeyService.getEphemeralPublicKey();

            if (refreshedPublicKey) {
              set({
                ephemeralPublicKey: refreshedPublicKey,
                ephemeralPublicKeyBytes: Array.from(
                  refreshedPublicKey.toRawBytes(),
                ),
                ephemeralPublicKeyFlag: refreshedPublicKey.flag(),
              });
            }
          }

          // At this point, we should have:
          // 1. An ephemeral key pair (either newly created or unlocked)
          // 2. The public key available
          const finalPublicKey = get().ephemeralPublicKey;
          if (!finalPublicKey) {
            throw new Error(
              "Ephemeral public key not available after initialization",
            );
          }

          // Before initializing device data, check if we have a JWT for this network
          // If we do, we cannot regenerate device data (would cause nonce mismatch)
          const hasJwt = await hasJwtForNetwork(currentChain);
          if (hasJwt) {
            // We have a JWT - check if device data exists
            const currentDeviceData = get().networkData[currentChain];
            if (currentDeviceData?.nonce && currentDeviceData?.maxEpoch) {
              // Device data exists - don't regenerate
              log.info(
                "Device data exists for chain, skipping initialization",
                {
                  chain: currentChain,
                },
              );
              set({
                loading: false,
                isLocked: false,
              });
              return;
            } else {
              // Device data missing but JWT exists - cannot regenerate
              log.warn(
                "Device data missing but JWT exists - cannot regenerate without causing nonce mismatch",
                {
                  chain: currentChain,
                },
              );
              // Don't regenerate - user will need to re-login
              set({
                loading: false,
                isLocked: false,
              });
              return;
            }
          }

          // No JWT exists - safe to initialize device data
          // Then, initialize for current chain
          log.info("Initializing device store for chain", {
            chain: currentChain,
          });
          await get().initializeForChain(currentChain);
          set({
            loading: false,
            isLocked: false,
          });
        } catch (error) {
          log.error("Error handling private key", error);
          set({
            error: error instanceof Error ? error.message : "Unknown error",
            loading: false,
          });
        }
      },

      initializeForChain: async (chain: SuiChain) => {
        log.info("Generating device data for chain", { chain });

        const suiClient = createSuiClient(chain);

        // 1. Get ephemeral public key
        const ephemeralPubkey = get().ephemeralPublicKey;

        if (!ephemeralPubkey) {
          throw new Error("Ephemeral public key not found");
        }

        // 2. generate new jwtRandomness (per-network to prevent cross-network conflicts)
        const jwtRandomness = generateRandomness().toString();

        // 3. Get max epoch
        // Epoch start is a Unix timestamp in milliseconds
        const { epoch, epochDurationMs, epochStartTimestampMs } =
          await suiClient.getLatestSuiSystemState();
        // Use current epoch - must stay aligned with maxEpochTimestampMs below
        const numericMaxEpoch = Number(epoch);

        // 4. Set maxEpoch expiry - must stay aligned with numericMaxEpoch (current epoch)
        const maxEpochTimestampMs =
          Number(epochStartTimestampMs) + Number(epochDurationMs);

        // 5. Generate nonce using the per-network jwtRandomness
        const nonce = generateNonce(
          ephemeralPubkey,
          numericMaxEpoch,
          jwtRandomness,
        );

        // Store jwtRandomness per-network to prevent cross-network conflicts
        // NOTE: ephemeralKeyPairSecretKey is device-level (not network-level) and is NOT modified here
        set({
          networkData: {
            ...get().networkData,
            [chain]: {
              maxEpoch: numericMaxEpoch.toString(),
              maxEpochTimestampMs: maxEpochTimestampMs,
              nonce: nonce,
              jwtRandomness: jwtRandomness,
            },
          },
          error: null,
        });
      },

      getZkProof: async () => {
        const currentChain = useNetworkStore.getState().chain;
        const maxEpoch = get().getMaxEpoch(currentChain);
        const maxEpochExpiry = get().getMaxEpochTimestampMs(currentChain);

        // First, check if we have a zkProof in keeper
        if (maxEpochExpiry && Date.now().valueOf() < maxEpochExpiry) {
          try {
            const zkProof = await zkProofService.getZkProof(currentChain);
            if (zkProof != null && zkProof.error === undefined) {
              log.info(
                "Max epoch not yet expired, reusing ZK proof from keeper",
              );
              log.debug("Using cached ZK proof", { zkProof });
              return zkProof;
            }
          } catch (error) {
            log.warn(
              "Failed to get zkProof from keeper, will generate new one:",
              error,
            );
          }

          log.info(
            "No ZK proof found in keeper, proceeding to generate new one",
          );
        }

        try {
          log.info("*********** Generating ZK proof ***********");

          const { user } = useAuthStore.getState();
          if (!user?.id_token) {
            throw new Error("User not authenticated");
          }

          const ephemeralPublicKey = get().ephemeralPublicKey;
          if (!ephemeralPublicKey) {
            throw new Error("Ephemeral public key not found");
          }

          const chain = useNetworkStore.getState().chain;
          const network = chain.replace("sui:", "") as string;

          // Verify that we have a JWT for the current network
          const hasJwt = await hasJwtForNetwork(chain);
          if (!hasJwt) {
            throw new Error(
              `No valid JWT found for ${network}. Please sign in again.`,
            );
          }

          // Verify that the nonce in the JWT matches the nonce for the current network
          const decodedJwt = decodeJwt(user.id_token);
          const jwtNonce = decodedJwt.nonce as string | undefined;
          const deviceNonce = get().getNonce(chain);

          if (jwtNonce && deviceNonce && jwtNonce !== deviceNonce) {
            log.error(
              "JWT nonce doesn't match device nonce for current network",
              {
                chain,
                jwtNonce,
                deviceNonce,
              },
            );
            // Nonce mismatch means device data was regenerated after OAuth
            // The nonce is derived from ephemeral key + maxEpoch + jwtRandomness
            // If these don't match what was used during OAuth, the JWT is invalid
            // We cannot generate a valid zkProof with mismatched parameters
            // User must re-login to regenerate device data that matches the new JWT
            throw new Error(
              `JWT nonce mismatch for ${network}. Device data was regenerated after login. Please sign in again to sync device data with your JWT.`,
            );
          }

          log.debug("User ID token:", user.id_token);
          log.debug("Generating ZK proof for network", { chain, network });

          // Get jwtRandomness for the current network (per-network, not global)
          const networkJwtRandomness = get().getJwtRandomness(chain);
          if (!networkJwtRandomness) {
            throw new Error(
              `JWT randomness not found for ${network}. Please sign in again.`,
            );
          }

          if (!maxEpoch) {
            throw new Error("Max epoch not found for current network");
          }

          const zkProofResponse: ZkProofResponse = await fetchZkProof({
            jwtRandomness: networkJwtRandomness,
            maxEpoch,
            ephemeralPublicKey,
            idToken: user.access_token,
            enokiApiKey: import.meta.env.VITE_ENOKI_API_KEY,
            network,
          });

          if (zkProofResponse.error === undefined) {
            // Store zkProof in keeper instead of deviceStore
            try {
              await zkProofService.setZkProof(chain, zkProofResponse);
              log.debug("zkProof stored in keeper");
            } catch (error) {
              log.error("Failed to store zkProof in keeper:", error);
              // Continue anyway - the proof is still valid
            }
            return zkProofResponse;
          } else {
            log.error("Error generating ZK proof", zkProofResponse.error);
            set({
              error: zkProofResponse.error?.message,
            });
            return zkProofResponse;
          }
        } catch (error) {
          log.error("Error generating ZK proof", error);
          set({
            error: error instanceof Error ? error.message : "Unknown error",
          });
          return {
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      },

      lock: async () => {
        await ephKeyService.lock();
        set({ isLocked: true });
      },

      unlock: async (pin: string) => {
        // Helper to set unlocked state with optional public key
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

          // PIN is required for both web and extension
          if (!pin || pin.trim().length === 0) {
            set({ error: "PIN is required" });
            return;
          }

          // Web: PIN decrypts the keypair from IndexedDB
          if (isWeb()) {
            const hasKeypair = await ephKeyService.hasKeypair();
            if (!hasKeypair) {
              set({ error: "No keypair available" });
              return;
            }

            // Unlock the vault with PIN (decrypts the stored key)
            const publicKey = await ephKeyService.unlockVault(null, pin);
            setUnlockedState(publicKey);
            return;
          }

          // Extension: password required
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
          networkData: {
            [SUI_DEVNET_CHAIN]: createEmptyNetworkDataEntry(),
            [SUI_TESTNET_CHAIN]: createEmptyNetworkDataEntry(),
            [SUI_LOCALNET_CHAIN]: createEmptyNetworkDataEntry(),
            [SUI_MAINNET_CHAIN]: createEmptyNetworkDataEntry(),
          },
        });
      },
    }),
    {
      name: "evevault:device",
      storage: createJSONStorage(() =>
        isWeb() ? localStorageAdapter : chromeStorageAdapter,
      ),
      // Exclude the class instance from persistence, only persist bytes and flag
      partialize: (state) => {
        return {
          ...state,
          ephemeralPublicKey: undefined, // Don't persist the class instance
          // ephemeralPublicKeyBytes and ephemeralPublicKeyFlag will be persisted
          // ephemeralKeyPairSecretKey is included (even if null) to preserve it in storage
          // Don't persist transient states
          loading: undefined,
          error: undefined,
        };
      },
      // Reconstruct the class instance from bytes on rehydration
      onRehydrateStorage: () => {
        return (state, error) => {
          if (error) {
            log.error("Error rehydrating device store", error);
            return;
          }

          // Validate and clean up ephemeralKeyPairSecretKey if it's an invalid object
          if (
            state &&
            state.ephemeralKeyPairSecretKey &&
            typeof state.ephemeralKeyPairSecretKey === "object"
          ) {
            const key = state.ephemeralKeyPairSecretKey;
            // If it's an object but doesn't have iv and data, it's invalid - set to null
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
                `Reconstructed ${
                  isWeb() ? "Secp256r1" : "Ed25519"
                } public key from storage`,
              );
            } else {
              state.ephemeralPublicKey = null;
              state.ephemeralPublicKeyBytes = null;
              state.ephemeralPublicKeyFlag = null;
            }
          }

          // Detect inconsistency: have public key but no secret key
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
            // In this case, we can't recover the secret key without the PIN, so we effectively reset the PIN state
            state.ephemeralPublicKey = null;
            state.ephemeralPublicKeyBytes = null;
            state.ephemeralPublicKeyFlag = null;
            state.isLocked = true; // Force lock if secret key is lost
          }

          // Web: Always start locked after rehydration since the signer is in-memory only
          // User will need to re-enter PIN to unlock
          if (isWeb() && state) {
            state.isLocked = true;
            state.loading = false;
          }
        };
      },
    },
  ),
);

/**
 * Waits for the device store to complete hydration from storage.
 * If already hydrated, returns immediately.
 * Otherwise, triggers rehydration and waits for it to complete.
 */
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

/**
 * Rehydrates the device store from storage.
 * Useful after the background script updates storage (e.g., after login)
 * to sync the popup's Zustand state with the latest persisted data.
 */
export const rehydrateDeviceStore = async () => {
  await new Promise<void>((resolve) => {
    const unsub = useDeviceStore.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
    useDeviceStore.persist.rehydrate();
  });
};
