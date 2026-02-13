import { getDeviceData, storeJwt } from "@evevault/shared";
import { exchangeCodeForToken } from "@evevault/shared/auth";
import { useDeviceStore } from "@evevault/shared/stores";
import { createLogger } from "@evevault/shared/utils";
import { Ed25519PublicKey } from "@mysten/sui/keypairs/ed25519";
import { decodeJwt } from "jose";
import { getAuthUrl } from "../../services/oauthService";
import { openPopupWindow } from "../../services/popupWindow";
import type { MessageWithId } from "../../types";
import {
  ensureMessageId,
  extractAuthCode,
  getCurrentChain,
  getCurrentChainFromStorage,
  sendAuthError,
  sendAuthSuccess,
} from "./authHelpers";
import {
  checkKeeperUnlocked,
  getEphemeralKeyPairSecretKeyFromStorage,
} from "./keeperHelpers";
import {
  KEEPER_RETRY_DELAY_MS,
  setPendingAuthAfterUnlock,
} from "./pendingAuth";

const log = createLogger();

export async function handleExtLogin(
  message: MessageWithId,
  _sender: chrome.runtime.MessageSender,
  _sendResponse: (response?: unknown) => void,
): Promise<void> {
  const id = ensureMessageId(message);

  const initialChain = getCurrentChain();

  const deviceStore = useDeviceStore.getState();
  const hasDeviceData = !!(
    deviceStore.ephemeralKeyPairSecretKey &&
    typeof deviceStore.ephemeralKeyPairSecretKey === "object" &&
    "iv" in deviceStore.ephemeralKeyPairSecretKey &&
    "data" in deviceStore.ephemeralKeyPairSecretKey
  );

  let keeperStatus = await checkKeeperUnlocked();
  if (!keeperStatus.unlocked) {
    if (hasDeviceData) {
      await new Promise((resolve) =>
        setTimeout(resolve, KEEPER_RETRY_DELAY_MS),
      );
      keeperStatus = await checkKeeperUnlocked();
      if (!keeperStatus.unlocked) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        keeperStatus = await checkKeeperUnlocked();
      }
    }

    if (!keeperStatus.unlocked) {
      log.error("Cannot login: vault not set up or locked", {
        chain: initialChain,
        hasDeviceData,
      });

      useDeviceStore.setState({ isLocked: true });
      const windowId = await openPopupWindow("popup");
      if (windowId === undefined) {
        log.warn("Failed to open vault popup window");
      }

      if (hasDeviceData) {
        setPendingAuthAfterUnlock(id, "ext", undefined, windowId);
        return;
      }

      return sendAuthError(id, {
        message:
          "Please set up or unlock the vault in the window we opened, then try again.",
        vaultOpened: true,
      });
    }
  }

  if (!deviceStore.ephemeralPublicKey && keeperStatus.publicKeyBytes) {
    log.info("Syncing ephemeral public key from keeper to deviceStore", {
      chain: initialChain,
    });
    try {
      const publicKey = new Ed25519PublicKey(
        new Uint8Array(keeperStatus.publicKeyBytes),
      );
      const secretKeyToPreserve =
        deviceStore.ephemeralKeyPairSecretKey ||
        (await getEphemeralKeyPairSecretKeyFromStorage());

      useDeviceStore.setState({
        ephemeralPublicKey: publicKey,
        ephemeralPublicKeyBytes: keeperStatus.publicKeyBytes,
        ephemeralPublicKeyFlag: publicKey.flag(),
        ephemeralKeyPairSecretKey: secretKeyToPreserve,
        isLocked: false,
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

  const currentChain = await getCurrentChainFromStorage();

  const existingNonce = deviceStore.getNonce(currentChain);
  const existingMaxEpoch = deviceStore.getMaxEpoch(currentChain);
  const maxEpochTimestampMs = deviceStore.getMaxEpochTimestampMs(currentChain);
  const existingJwtRandomness = deviceStore.getJwtRandomness?.(currentChain);
  const hasJwtRandomness = !!existingJwtRandomness;

  const { getJwtForNetwork } = await import("@evevault/shared/auth");
  const existingJwt = await getJwtForNetwork(currentChain);
  const hasExistingJwt = !!existingJwt?.id_token;

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
      const errorMessage =
        error instanceof Error ? error.message : String(error);

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

      log.error("Device initialization failed", { error: errorMessage });
      return sendAuthError(id, {
        message: `Failed to initialize device: ${errorMessage}`,
      });
    }
  } else if (hasExistingJwt && jwtNonceMatches && isExpired) {
    log.warn(
      "Device data expired but JWT nonce matches - cannot regenerate without causing mismatch. User needs to re-login.",
      {
        chain: currentChain,
        maxEpochTimestampMs,
        isExpired,
      },
    );
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

  const { jwtRandomness, nonce, maxEpoch } = await getDeviceData(currentChain);

  const authUrl = getAuthUrl({
    jwtRandomness,
    nonce,
    maxEpoch,
  });

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

        const chainAfterOAuth = await getCurrentChainFromStorage();

        if (chainAfterOAuth !== currentChain) {
          log.error("Network changed during OAuth flow - aborting login", {
            chainAtOAuthStart: currentChain,
            chainAfterOAuth,
          });
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
