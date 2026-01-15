import { getDeviceData, storeJwt } from "@evevault/shared";
import { exchangeCodeForToken } from "@evevault/shared/auth";
import { useDeviceStore, useNetworkStore } from "@evevault/shared/stores";
import type {
  JwtResponse,
  PersistedDeviceStore,
  PersistedDeviceStoreState,
  StoredSecretKey,
} from "@evevault/shared/types";
import { KeeperMessageTypes } from "@evevault/shared/types";
import { createLogger } from "@evevault/shared/utils";
import { Ed25519PublicKey } from "@mysten/sui/keypairs/ed25519";
import type { SuiChain } from "@mysten/wallet-standard";
import { decodeJwt } from "jose";
import type { IdTokenClaims } from "oidc-client-ts";
import { getAuthUrl } from "../services/oauthService";
import { ensureOffscreen } from "../services/offscreenService";
import type { MessageWithId, WebUnlockMessage } from "../types";

const log = createLogger();

/** Delay in ms before retrying keeper unlock check (gives unlock time to complete) */
const KEEPER_RETRY_DELAY_MS = 100;

const ensureMessageId = (message: MessageWithId): string => {
  if (!message.id) {
    throw new Error("Message id is required");
  }
  return message.id;
};

/**
 * Reads ephemeralKeyPairSecretKey from Chrome storage if it's null in memory.
 * This handles the race condition where the background script's Zustand store
 * hasn't rehydrated yet when setState is called.
 */
async function getEphemeralKeyPairSecretKeyFromStorage(): Promise<StoredSecretKey | null> {
  if (typeof chrome === "undefined" || !chrome.storage) {
    return null;
  }

  try {
    const stored = await new Promise<unknown>((resolve) => {
      chrome.storage.local.get(["evevault:device"], (result) => {
        resolve(result["evevault:device"] || null);
      });
    });

    if (!stored) {
      return null;
    }

    let persistedState: PersistedDeviceStoreState | null = null;
    if (typeof stored === "string") {
      persistedState =
        (JSON.parse(stored) as PersistedDeviceStore).state ?? null;
    } else if (
      typeof stored === "object" &&
      stored !== null &&
      "state" in stored
    ) {
      persistedState = (stored as PersistedDeviceStore).state ?? null;
    }

    const storedKey = persistedState?.ephemeralKeyPairSecretKey;
    if (
      storedKey &&
      typeof storedKey === "object" &&
      storedKey !== null &&
      "iv" in storedKey &&
      "data" in storedKey
    ) {
      return storedKey as StoredSecretKey;
    }
  } catch (error) {
    log.warn(
      "Failed to retrieve ephemeralKeyPairSecretKey from storage",
      error,
    );
  }

  return null;
}

/**
 * Checks if the keeper has an unlocked ephemeral key and returns the public key bytes if available
 */
async function checkKeeperUnlocked(): Promise<{
  unlocked: boolean;
  publicKeyBytes?: number[];
}> {
  try {
    await ensureOffscreen(true);
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: KeeperMessageTypes.GET_PUBLIC_KEY, target: "KEEPER" },
        (response) => {
          if (chrome.runtime.lastError) {
            log.error("Error checking keeper", chrome.runtime.lastError);
            resolve({ unlocked: false });
            return;
          }
          // If response has ok: true, keeper is unlocked
          if (response?.ok === true && response?.publicKeyBytes) {
            resolve({
              unlocked: true,
              publicKeyBytes: response.publicKeyBytes,
            });
          } else {
            resolve({ unlocked: false });
          }
        },
      );
    });
  } catch (error) {
    log.error("Failed to check keeper status", error);
    return { unlocked: false };
  }
}

async function handleExtLogin(
  message: MessageWithId,
  _sender: chrome.runtime.MessageSender,
  _sendResponse: (response?: unknown) => void,
): Promise<void> {
  const id = ensureMessageId(message);

  // Read chain at start for device data initialization
  const initialChain = getCurrentChain();

  // Check device data existence before checking keeper status
  const deviceStore = useDeviceStore.getState();
  const hasDeviceData = !!(
    deviceStore.ephemeralKeyPairSecretKey &&
    typeof deviceStore.ephemeralKeyPairSecretKey === "object" &&
    "iv" in deviceStore.ephemeralKeyPairSecretKey &&
    "data" in deviceStore.ephemeralKeyPairSecretKey
  );

  // Check if the keeper has an unlocked ephemeral key
  let keeperStatus = await checkKeeperUnlocked();
  if (!keeperStatus.unlocked) {
    // Only retry if device data exists - if no device data, vault isn't set up yet so no point retrying
    if (hasDeviceData) {
      await new Promise((resolve) =>
        setTimeout(resolve, KEEPER_RETRY_DELAY_MS),
      );
      keeperStatus = await checkKeeperUnlocked();
    }

    if (!keeperStatus.unlocked) {
      const errorMessage = hasDeviceData
        ? "Vault is locked. Please unlock the vault first, then try signing in again."
        : "Vault not set up or locked. Please unlock the vault first.";
      log.error("Cannot login: vault not set up or locked", {
        chain: initialChain,
        hasDeviceData,
      });
      return sendAuthError(id, {
        message: errorMessage,
      });
    }
  }

  // Ensure deviceStore has the ephemeral public key (needed for initializeForChain)
  if (!deviceStore.ephemeralPublicKey && keeperStatus.publicKeyBytes) {
    log.info("Syncing ephemeral public key from keeper to deviceStore", {
      chain: initialChain,
    });
    try {
      // Reconstruct the public key from bytes (extension always uses Ed25519)
      const publicKey = new Ed25519PublicKey(
        new Uint8Array(keeperStatus.publicKeyBytes),
      );
      // Preserve ephemeralKeyPairSecretKey - read from storage if null in memory
      // (handles race condition where background script hasn't rehydrated yet)
      const secretKeyToPreserve =
        deviceStore.ephemeralKeyPairSecretKey ||
        (await getEphemeralKeyPairSecretKeyFromStorage());

      useDeviceStore.setState({
        ephemeralPublicKey: publicKey,
        ephemeralPublicKeyBytes: keeperStatus.publicKeyBytes,
        ephemeralPublicKeyFlag: publicKey.flag(),
        ephemeralKeyPairSecretKey: secretKeyToPreserve,
      });
      log.debug("Successfully synced ephemeral public key to deviceStore");
    } catch (error) {
      log.error("Failed to sync public key from keeper", error);
      return sendAuthError(id, {
        message: "Failed to sync vault state. Please try unlocking again.",
      });
    }
  } else if (!deviceStore.ephemeralPublicKey) {
    log.error("Keeper is unlocked but no public key bytes available", {
      chain: initialChain,
    });
    return sendAuthError(id, {
      message: "Vault state is inconsistent. Please unlock the vault again.",
    });
  }

  // Read chain from storage to ensure we use the current network (not stale Zustand state)
  const currentChain = await getCurrentChainFromStorage();

  // Check if device data exists and is valid BEFORE starting OAuth
  const existingNonce = deviceStore.getNonce(currentChain);
  const existingMaxEpoch = deviceStore.getMaxEpoch(currentChain);
  const maxEpochTimestampMs = deviceStore.getMaxEpochTimestampMs(currentChain);
  // Check per-network jwtRandomness
  const existingJwtRandomness = deviceStore.getJwtRandomness?.(currentChain);
  const hasJwtRandomness = !!existingJwtRandomness;

  // Check if we have an existing JWT for this network
  // If we do, we need to verify the nonce matches before regenerating device data
  const { getJwtForNetwork } = await import("@evevault/shared/auth");
  const existingJwt = await getJwtForNetwork(currentChain);
  const hasExistingJwt = !!existingJwt?.id_token;

  // If we have an existing JWT, check if its nonce matches current device data
  let jwtNonceMatches = false;
  if (hasExistingJwt && existingNonce) {
    try {
      const decodedJwt = decodeJwt(existingJwt.id_token);
      const jwtNonce = decodedJwt.nonce as string | undefined;
      jwtNonceMatches = jwtNonce === existingNonce;
      log.debug("Checking JWT nonce against device data", {
        chain: currentChain,
        jwtNonce,
        deviceNonce: existingNonce,
        matches: jwtNonceMatches,
      });
    } catch (error) {
      log.warn("Failed to decode existing JWT for nonce check", error);
    }
  }

  // Only regenerate if device data is truly missing or expired
  // BUT: If we have an existing JWT with a matching nonce, don't regenerate even if expired
  // (regenerating would create a nonce mismatch - user needs to re-login instead)
  const isExpired = maxEpochTimestampMs
    ? Date.now() >= maxEpochTimestampMs
    : false;
  const needsRegeneration =
    (!existingNonce ||
      !existingMaxEpoch ||
      !hasJwtRandomness ||
      !maxEpochTimestampMs ||
      isExpired) &&
    !(hasExistingJwt && jwtNonceMatches);

  if (needsRegeneration) {
    log.info("Device data expired or missing, regenerating before login", {
      chain: currentChain,
      hasNonce: !!existingNonce,
      hasMaxEpoch: !!existingMaxEpoch,
      hasJwtRandomness,
      maxEpochTimestampMs,
      isExpired,
      hasExistingJwt,
      jwtNonceMatches,
    });
    try {
      await deviceStore.initializeForChain(currentChain);
    } catch (error) {
      // Check if this is a network connectivity error using structured checks
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Prefer structured checks over brittle message matching
      const withNetworkMeta = error as {
        code?: unknown;
        status?: unknown;
        cause?: unknown;
      };

      const status =
        typeof withNetworkMeta.status === "number"
          ? withNetworkMeta.status
          : undefined;
      const errorCode =
        typeof withNetworkMeta.code === "string"
          ? withNetworkMeta.code
          : undefined;

      const causeMessage =
        withNetworkMeta.cause instanceof Error
          ? withNetworkMeta.cause.message
          : undefined;

      const isFetchTypeError = error instanceof TypeError;
      const isStatusNetworkError =
        typeof status === "number" &&
        (status === 0 || (status >= 500 && status < 600));
      const isCodeNetworkError =
        errorCode === "ECONNREFUSED" ||
        errorCode === "ETIMEDOUT" ||
        errorCode === "ECONNRESET";

      const isMessageNetworkError =
        errorMessage.includes("503") ||
        errorMessage.includes("Failed to fetch") ||
        errorMessage.includes("no healthy upstream") ||
        errorMessage.includes("ECONNREFUSED") ||
        errorMessage.includes("ETIMEDOUT") ||
        (typeof causeMessage === "string" &&
          (causeMessage.includes("Failed to fetch") ||
            causeMessage.includes("ECONNREFUSED") ||
            causeMessage.includes("ETIMEDOUT")));

      const isNetworkError =
        isFetchTypeError ||
        isStatusNetworkError ||
        isCodeNetworkError ||
        isMessageNetworkError;

      if (isNetworkError) {
        log.error("Network unavailable during device initialization", {
          chain: currentChain,
          error: errorMessage,
        });
        return sendAuthError(id, {
          message: `The ${currentChain.replace("sui:", "")} network is currently unavailable. Please try a different network or try again later.`,
        });
      }

      // Re-throw other errors
      log.error("Device initialization failed", { error: errorMessage });
      return sendAuthError(id, {
        message: `Failed to initialize device: ${errorMessage}`,
      });
    }
  } else if (hasExistingJwt && jwtNonceMatches && isExpired) {
    // Device data expired but JWT nonce matches - this is a problem
    // We can't regenerate device data (would cause nonce mismatch)
    // User needs to re-login to get fresh device data
    log.warn(
      "Device data expired but JWT nonce matches - cannot regenerate without causing mismatch. User needs to re-login.",
      {
        chain: currentChain,
        maxEpochTimestampMs,
        isExpired,
      },
    );
    // Clear the JWT to force re-login
    const { clearJwtForNetwork } = await import("@evevault/shared/auth");
    await clearJwtForNetwork(currentChain);
    return sendAuthError(id, {
      message:
        "Device data expired. Please sign in again to refresh your session.",
    });
  } else {
    log.info("Using existing device data for login", {
      chain: currentChain,
      nonce: existingNonce,
      maxEpoch: existingMaxEpoch,
      hasExistingJwt,
      jwtNonceMatches,
    });
  }

  // Get device data for the CURRENT chain (ensures we use the data we just verified/regenerated)
  const { jwtRandomness, nonce, maxEpoch } = await getDeviceData(currentChain);

  // Build auth URL
  const authUrl = getAuthUrl({
    jwtRandomness,
    nonce,
    maxEpoch,
  });

  // Launch OAuth flow
  chrome.identity.launchWebAuthFlow(
    { url: authUrl.toString(), interactive: true },
    async (responseUrl) => {
      if (chrome.runtime.lastError) {
        return sendAuthError(id, chrome.runtime.lastError);
      }

      if (!responseUrl) {
        return sendAuthError(id, { message: "No response URL received" });
      }

      try {
        const authCode = extractAuthCode(responseUrl);
        if (!authCode) {
          return sendAuthError(id, {
            message: "No authorization code received",
          });
        }

        const jwtResponse = await exchangeCodeForToken(
          authCode,
          chrome.identity.getRedirectURL(),
        );

        // Read chain after OAuth completes - user might have switched networks during the flow
        const chainAfterOAuth = await getCurrentChainFromStorage();

        // Verify chain hasn't changed during OAuth (if it has, device data won't match)
        if (chainAfterOAuth !== currentChain) {
          log.error("Network changed during OAuth flow - aborting login", {
            chainAtOAuthStart: currentChain,
            chainAfterOAuth,
          });
          // Abort login to prevent nonce mismatch
          // The device data we used for OAuth was for currentChain (start of flow),
          // but the user switched to chainAfterOAuth. Storing JWT would cause nonce mismatch.
          return sendAuthError(id, {
            message:
              "Network was switched during login. Please try logging in again.",
          });
        }

        log.info("Storing JWT for network", {
          chain: currentChain,
          hasJwt: !!jwtResponse.id_token,
        });
        await storeJwt(jwtResponse, currentChain);

        sendAuthSuccess(id, jwtResponse);
      } catch (error) {
        sendAuthError(id, error);
      }
    },
  );
}

async function handleDappLogin(
  message: MessageWithId,
  _sender: chrome.runtime.MessageSender,
  _sendResponse: (response?: unknown) => void,
  tabId?: number,
): Promise<void> {
  // Dapp login uses the chrome redirect uri
  // This is because the dapp login is triggered by the content script
  // and we need to use the chrome redirect uri to get the auth code

  const id = ensureMessageId(message);

  const clientId = import.meta.env.VITE_FUSIONAUTH_CLIENT_ID;
  const chromeRedirectUri = chrome.identity.getRedirectURL();

  const chain = getCurrentChain();

  // Check device data existence before checking keeper status
  const deviceStore = useDeviceStore.getState();
  const hasDeviceData = !!(
    deviceStore.ephemeralKeyPairSecretKey &&
    typeof deviceStore.ephemeralKeyPairSecretKey === "object" &&
    "iv" in deviceStore.ephemeralKeyPairSecretKey &&
    "data" in deviceStore.ephemeralKeyPairSecretKey
  );

  // Check if the keeper has an unlocked ephemeral key
  let keeperStatus = await checkKeeperUnlocked();
  if (!keeperStatus.unlocked) {
    // Only retry if device data exists - if no device data, vault isn't set up yet so no point retrying
    if (hasDeviceData) {
      await new Promise((resolve) =>
        setTimeout(resolve, KEEPER_RETRY_DELAY_MS),
      );
      keeperStatus = await checkKeeperUnlocked();
    }

    if (!keeperStatus.unlocked) {
      const errorMessage = hasDeviceData
        ? "Vault is locked. Please unlock the vault first, then try signing in again."
        : "Vault not set up or locked. Please unlock the vault first.";
      log.error("Cannot login: vault not set up or locked", {
        chain,
        hasDeviceData,
      });
      if (typeof tabId === "number") {
        chrome.tabs.sendMessage(tabId, {
          id,
          type: "auth_error",
          error: {
            message: errorMessage,
          },
        });
      }
      return;
    }
  }

  // Ensure deviceStore has the ephemeral public key (needed for initializeForChain)
  if (!deviceStore.ephemeralPublicKey && keeperStatus.publicKeyBytes) {
    log.info("Syncing ephemeral public key from keeper to deviceStore", {
      chain,
    });
    try {
      // Reconstruct the public key from bytes (extension always uses Ed25519)
      const publicKey = new Ed25519PublicKey(
        new Uint8Array(keeperStatus.publicKeyBytes),
      );
      // Preserve ephemeralKeyPairSecretKey - read from storage if null in memory
      const secretKeyToPreserve =
        deviceStore.ephemeralKeyPairSecretKey ||
        (await getEphemeralKeyPairSecretKeyFromStorage());

      useDeviceStore.setState({
        ephemeralPublicKey: publicKey,
        ephemeralPublicKeyBytes: keeperStatus.publicKeyBytes,
        ephemeralPublicKeyFlag: publicKey.flag(),
        ephemeralKeyPairSecretKey: secretKeyToPreserve,
      });
      log.debug("Successfully synced ephemeral public key to deviceStore");
    } catch (error) {
      log.error("Failed to sync public key from keeper", error);
      if (typeof tabId === "number") {
        chrome.tabs.sendMessage(tabId, {
          id,
          type: "auth_error",
          error: {
            message: "Failed to sync vault state. Please try unlocking again.",
          },
        });
      }
      return;
    }
  } else if (!deviceStore.ephemeralPublicKey) {
    log.error("Keeper is unlocked but no public key bytes available", {
      chain,
    });
    if (typeof tabId === "number") {
      chrome.tabs.sendMessage(tabId, {
        id,
        type: "auth_error",
        error: {
          message:
            "Vault state is inconsistent. Please unlock the vault again.",
        },
      });
    }
    return;
  }

  // Check if device data is expired and regenerate if needed BEFORE starting OAuth
  const maxEpochTimestampMs = deviceStore.getMaxEpochTimestampMs(chain);

  if (!maxEpochTimestampMs || Date.now() >= maxEpochTimestampMs) {
    log.info("Device data expired or missing, regenerating before dapp login", {
      chain,
      maxEpochTimestampMs,
    });
    await deviceStore.initializeForChain(chain);
  }

  const { jwtRandomness, nonce, maxEpoch } = await getDeviceData(chain);

  if (!nonce || !jwtRandomness || !maxEpoch) {
    throw new Error(
      "Device data not initialized. OAuth params may be missing.",
    );
  }

  const authUrl = await getAuthUrl({
    nonce,
    jwtRandomness,
    maxEpoch,
  });

  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", chromeRedirectUri);
  authUrl.searchParams.set("scope", "openid profile email offline_access");

  chrome.identity.launchWebAuthFlow(
    {
      url: authUrl.toString(),
      interactive: true,
    },
    (responseUrl) => {
      if (chrome.runtime.lastError || !responseUrl) {
        chrome.runtime.sendMessage({
          id,
          auth_success: false,
          error: chrome.runtime.lastError?.message || "responseUrl not found",
        });
        chrome.runtime.sendMessage({
          id,
          type: "auth_error",
          error: chrome.runtime.lastError,
        });
        return;
      }

      // Extract auth code from responseUrl
      const urlParams = new URL(responseUrl).searchParams;
      const authCode = urlParams.get("code");

      if (!authCode) {
        chrome.runtime.sendMessage({
          id,
          auth_success: false,
          error: "Authorization code not found in response.",
        });
        return;
      }

      log.debug("Auth code received");

      exchangeCodeForToken(authCode, chromeRedirectUri)
        .then(async (jwtResponse) => {
          const decodedJwt = decodeJwt<IdTokenClaims>(
            jwtResponse.id_token as string,
          );
          const network = useNetworkStore.getState().chain;

          // Store JWT using shared storage service (merges with existing JWTs)
          await storeJwt(jwtResponse, network);

          if (typeof tabId === "number") {
            chrome.tabs.sendMessage(tabId, {
              id,
              type: "auth_success",
              token: {
                ...jwtResponse,
                email: decodedJwt.email,
                userId: decodedJwt.sub,
              },
            });
          }
        })
        .catch((error) => {
          log.error("Token exchange failed", error);
          chrome.runtime.sendMessage({
            auth_success: false,
            error: error,
          });
        });
    },
  );
}

async function handleWebUnlock(
  message: WebUnlockMessage,
  _sender: chrome.runtime.MessageSender,
  _sendResponse: (response?: unknown) => void,
): Promise<void> {
  log.info("Evefrontier web unlock request");

  const { jwt, tabId } = message;
  const id = ensureMessageId(message);

  const decodedJwt = decodeJwt<IdTokenClaims>(jwt.id_token as string);
  const network = useNetworkStore.getState().chain;

  // Store JWT using shared storage service (merges with existing JWTs)
  await storeJwt(jwt, network);

  if (typeof tabId === "number") {
    chrome.tabs.sendMessage(tabId, {
      id,
      type: "auth_success",
      token: {
        ...jwt,
        email: decodedJwt.email,
        userId: decodedJwt.sub,
      },
    });
  }
}

// Helper functions
function getCurrentChain(): SuiChain {
  return useNetworkStore.getState().chain;
}

/**
 * Reads the current chain directly from chrome.storage to avoid Zustand sync issues
 * between popup and background script. This ensures we get the most up-to-date network
 * state when storing JWTs during OAuth callbacks.
 */
async function getCurrentChainFromStorage(): Promise<SuiChain> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["evevault:network"], (result) => {
      try {
        const stored = result["evevault:network"];
        if (stored) {
          const parsed =
            typeof stored === "string" ? JSON.parse(stored) : stored;
          if (parsed?.state?.chain) {
            log.debug("Read chain from storage", { chain: parsed.state.chain });
            resolve(parsed.state.chain);
            return;
          }
        }
      } catch (error) {
        log.error("Error reading chain from storage", error);
      }
      // Fallback to Zustand store if storage read fails
      const fallbackChain = useNetworkStore.getState().chain;
      log.debug("Using fallback chain from Zustand", { chain: fallbackChain });
      resolve(fallbackChain);
    });
  });
}

function extractAuthCode(responseUrl: string) {
  return new URL(responseUrl).searchParams.get("code");
}

function sendAuthSuccess(id: string, jwt: JwtResponse) {
  chrome.runtime.sendMessage({
    id,
    type: "auth_success",
    token: {
      ...jwt,
      email: extractEmailFromJwt(jwt),
      userId: extractUserIdFromJwt(jwt),
    },
  });
}

function sendAuthError(id: string, error: unknown) {
  chrome.runtime.sendMessage({
    id,
    type: "auth_error",
    error,
  });
}

function extractEmailFromJwt(jwt: JwtResponse) {
  const decoded = decodeJwt<IdTokenClaims>(jwt.id_token as string);
  return decoded.email as string;
}

function extractUserIdFromJwt(jwt: JwtResponse) {
  const decoded = decodeJwt<IdTokenClaims>(jwt.id_token as string);
  return decoded.sub as string;
}

export { handleExtLogin, handleDappLogin, handleWebUnlock };
