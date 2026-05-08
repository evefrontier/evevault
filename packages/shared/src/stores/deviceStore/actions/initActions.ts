import { generateNonce, generateRandomness } from "@mysten/sui/zklogin";
import type { SuiChain } from "@mysten/wallet-standard";
import { clearAllZkLoginJwts } from "#/auth/storageService";
import { ephKeyService, zkProofService } from "#/services/vaultService";
import { createInitialNetworkData } from "#/stores/deviceStore/constants";
import { resolveStoredSecretKey } from "#/stores/deviceStore/keyHelpers";
import { getCurrentEpochFromGraphQL } from "#/sui/graphqlEpoch";
import { getCurrentEpochFromRpc } from "#/sui/rpcEpoch";
import type {
  DeviceState,
  NetworkDataEntry,
  PersistedDeviceStore,
  PersistedDeviceStoreState,
  StoredSecretKey,
} from "#/types";
import { isLocalnetChain, isZkLoginSuiChain } from "#/types/networks";
import { createWebCryptoPlaceholder } from "#/types/wallet";
import { isWeb } from "#/utils/environment";
import { createLogger } from "#/utils/logger";
import { DEVICE_STORAGE_KEY } from "#/utils/storageKeys";
import type { GetDeviceState, SetDeviceState } from "./types";

const log = createLogger();

export function createInitActions(set: SetDeviceState, get: GetDeviceState) {
  const setChainData = (chain: SuiChain, data: NetworkDataEntry) => {
    if (!isZkLoginSuiChain(chain)) return;
    set({
      networkData: {
        ...get().networkData,
        [chain]: data,
      },
      error: null,
    });
  };

  const initializeLocalnetChainData = async () => {
    const localnetUrl = get().localnet.url;
    if (!localnetUrl) {
      log.warn("Localnet URL not configured, skipping epoch fetch");
      set({
        localnet: {
          ...get().localnet,
          maxEpoch: null,
          maxEpochTimestampMs: null,
        },
        error: null,
      });
      return;
    }

    try {
      const { numericMaxEpoch, maxEpochTimestampMs } =
        await getCurrentEpochFromRpc(localnetUrl);
      set({
        localnet: {
          ...get().localnet,
          maxEpoch: numericMaxEpoch.toString(),
          maxEpochTimestampMs,
        },
        error: null,
      });
    } catch (err) {
      log.error("Failed to fetch localnet epoch", err);
      set({
        localnet: {
          ...get().localnet,
          maxEpoch: null,
          maxEpochTimestampMs: null,
        },
        error: null,
      });
    }
  };

  const initializeZkLoginChainData = async (chain: SuiChain) => {
    if (!isZkLoginSuiChain(chain)) return;
    const ephemeralPubkey = get().ephemeralPublicKey;
    if (!ephemeralPubkey) {
      throw new Error("Ephemeral public key not found");
    }

    const jwtRandomness = generateRandomness().toString();
    const { numericMaxEpoch, maxEpochTimestampMs } =
      await getCurrentEpochFromGraphQL(chain);

    const nonce = generateNonce(
      ephemeralPubkey,
      numericMaxEpoch,
      jwtRandomness,
    );

    setChainData(chain, {
      maxEpoch: numericMaxEpoch.toString(),
      maxEpochTimestampMs,
      nonce,
      jwtRandomness,
    });
  };

  return {
    initialize: async (pin: string, currentChain: SuiChain) => {
      set({ loading: true });

      if (!pin || pin.trim().length === 0) {
        set({
          error: "PIN is required",
          loading: false,
        });
        return;
      }

      const currentState = get();

      const networkDataEntry = isZkLoginSuiChain(currentChain)
        ? currentState.networkData[currentChain]
        : undefined;
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
        await ephKeyService.initialize();

        if (isWeb()) {
          const hasExistingKeypair = await ephKeyService.hasKeypair();

          if (hasExistingKeypair) {
            log.info("[web] Found existing encrypted keypair in IndexedDB");
            const publicKey = await ephKeyService.unlockVault(null, pin);

            if (publicKey) {
              set({
                ephemeralPublicKey: publicKey,
                ephemeralPublicKeyBytes: Array.from(publicKey.toRawBytes()),
                ephemeralPublicKeyFlag: publicKey.flag(),
                ephemeralKeyPairSecretKey: createWebCryptoPlaceholder(),
              });

              const isExpired =
                maxEpochTimestampMs != null &&
                Date.now() >= maxEpochTimestampMs;
              if (!nonce || !maxEpoch || !maxEpochTimestampMs || isExpired) {
                await get().initializeForChain(currentChain);
              }
              set({ loading: false, isLocked: false });
              return;
            }
          }

          log.info("[web] Creating new Secp256r1 keypair (encrypted with PIN)");
          const { publicKey } = await ephKeyService.createEphemeralKeyPair(pin);

          set({
            ephemeralPublicKey: publicKey,
            ephemeralPublicKeyBytes: Array.from(publicKey.toRawBytes()),
            ephemeralPublicKeyFlag: publicKey.flag(),
            ephemeralKeyPairSecretKey: createWebCryptoPlaceholder(),
          });

          await get().initializeForChain(currentChain);
          set({ loading: false, isLocked: false });
          return;
        }

        const normalizedCurrentSecretKey = await resolveStoredSecretKey(
          currentState.ephemeralKeyPairSecretKey,
          pin,
        );
        let storedSecretKey: StoredSecretKey = normalizedCurrentSecretKey;

        if (
          jwtRandomness &&
          maxEpoch !== null &&
          nonce !== null &&
          maxEpochTimestampMs !== null &&
          storedSecretKey &&
          Date.now() < maxEpochTimestampMs
        ) {
          log.debug("Device store already initialized, skipping re-init");
          set({ loading: false });
          return;
        }

        if (
          !jwtRandomness ||
          !maxEpoch ||
          !nonce ||
          !maxEpochTimestampMs ||
          !storedSecretKey
        ) {
          const persistedDeviceStore = await new Promise<unknown>((resolve) => {
            chrome.storage.local.get([DEVICE_STORAGE_KEY], (result) => {
              resolve(result[DEVICE_STORAGE_KEY] || null);
            });
          });

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
                  (persistedDeviceStore as PersistedDeviceStore).state ?? null;
              }

              if (persistedDeviceStoreState) {
                const persistedNetworkData = isZkLoginSuiChain(currentChain)
                  ? persistedDeviceStoreState.networkData?.[currentChain]
                  : undefined;
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

        const needsNewKeyPair = !storedSecretKey || !ephemeralKeyPairSecretKey;

        if (needsNewKeyPair) {
          log.info("No existing ephemeral key pair found, creating new one");
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
          log.info("Existing ephemeral key pair found, unlocking vault");
          await ephKeyService.unlockVault(storedSecretKey, pin);
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

        const finalPublicKey = get().ephemeralPublicKey;
        if (!finalPublicKey) {
          throw new Error(
            "Ephemeral public key not available after initialization",
          );
        }

        const currentDeviceData = isLocalnetChain(currentChain)
          ? {
              maxEpoch: get().localnet.maxEpoch,
              maxEpochTimestampMs: get().localnet.maxEpochTimestampMs,
              nonce: "localnet",
            }
          : isZkLoginSuiChain(currentChain)
            ? get().networkData[currentChain]
            : undefined;
        const isExpired =
          currentDeviceData?.maxEpochTimestampMs != null &&
          Date.now() >= currentDeviceData.maxEpochTimestampMs;
        if (
          !currentDeviceData?.nonce ||
          !currentDeviceData?.maxEpoch ||
          isExpired
        ) {
          log.info("Initializing device store for chain", {
            chain: currentChain,
          });
          await get().initializeForChain(currentChain);
        }
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

      if (isLocalnetChain(chain)) {
        await initializeLocalnetChainData();
        return;
      }

      await initializeZkLoginChainData(chain);
    },

    rotateEphemeralKey: async (currentChain: SuiChain) => {
      log.info("Rotating ephemeral key", { currentChain });

      // Clear derived state before generating the new key. If rotateEphemeralKeyPair()
      // subsequently fails, JWTs and proofs are already cleared but the key is unchanged;
      // state is partially reset until initializeForChain is called again.
      await Promise.all([clearAllZkLoginJwts(), zkProofService.clear()]);

      const { hashedSecretKey, publicKey } =
        await ephKeyService.rotateEphemeralKeyPair();

      set({
        ephemeralPublicKey: publicKey,
        ephemeralPublicKeyBytes: Array.from(publicKey.toRawBytes()),
        ephemeralPublicKeyFlag: publicKey.flag(),
        ephemeralKeyPairSecretKey: isWeb()
          ? createWebCryptoPlaceholder()
          : hashedSecretKey,
        networkData: createInitialNetworkData(),
        error: null,
        isLocked: false,
      });

      await get().initializeForChain(currentChain);
    },
  } satisfies Pick<
    DeviceState,
    "initialize" | "initializeForChain" | "rotateEphemeralKey"
  >;
}
