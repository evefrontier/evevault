import { getDeviceData, storeJwt } from "@evevault/shared";
import {
  exchangeCodeForToken,
  getJwtForNetwork,
  hasJwtForNetwork,
} from "@evevault/shared/auth";
import { useDeviceStore, useNetworkStore } from "@evevault/shared/stores";
import { createLogger } from "@evevault/shared/utils";
import { Ed25519PublicKey } from "@mysten/sui/keypairs/ed25519";
import { decodeJwt } from "jose";
import type { IdTokenClaims } from "oidc-client-ts";
import { getAuthUrl } from "../../services/oauthService";
import { openPopupWindow } from "../../services/popupWindow";
import type { MessageWithId } from "../../types";
import { ensureMessageId, getCurrentChain } from "./authHelpers";
import {
  checkKeeperUnlocked,
  getEphemeralKeyPairSecretKeyFromStorage,
} from "./keeperHelpers";
import {
  KEEPER_RETRY_DELAY_MS,
  setPendingAuthAfterUnlock,
} from "./pendingAuth";

const log = createLogger();

export async function handleDappLogin(
  message: MessageWithId,
  _sender: chrome.runtime.MessageSender,
  _sendResponse: (response?: unknown) => void,
  tabId?: number,
): Promise<void> {
  const id = ensureMessageId(message);

  const clientId = import.meta.env.VITE_FUSIONAUTH_CLIENT_ID;
  const chromeRedirectUri = chrome.identity.getRedirectURL();

  const chain = getCurrentChain();

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
        chain,
        hasDeviceData,
      });

      useDeviceStore.setState({ isLocked: true });
      const windowId = await openPopupWindow("popup");
      if (windowId === undefined) {
        log.warn("Failed to open vault popup window");
      }

      if (hasDeviceData) {
        setPendingAuthAfterUnlock(id, "dapp", tabId, windowId);
        return;
      }

      const errorMessage =
        "Please set up or unlock the vault in the window we opened, then try again.";
      if (typeof tabId === "number") {
        chrome.tabs.sendMessage(tabId, {
          id,
          type: "auth_error",
          error: { message: errorMessage, vaultOpened: true },
        });
      }
      return;
    }
  }

  if (!deviceStore.ephemeralPublicKey && keeperStatus.publicKeyBytes) {
    log.info("Syncing ephemeral public key from keeper to deviceStore", {
      chain,
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

  if (typeof tabId === "number") {
    const hasJwt = await hasJwtForNetwork(chain);
    if (hasJwt) {
      const existingJwt = await getJwtForNetwork(chain);
      if (existingJwt?.id_token) {
        const decodedJwt = decodeJwt<IdTokenClaims>(
          existingJwt.id_token as string,
        );
        log.debug(
          "Connect: already connected, sending auth_success without OIDC",
        );
        chrome.tabs.sendMessage(tabId, {
          id,
          type: "auth_success",
          token: {
            ...existingJwt,
            email: decodedJwt.email,
            userId: decodedJwt.sub,
          },
        });
        return;
      }
    }
  }

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
