import { LOCALNET_STORAGE_KEY, storeJwt } from "@evevault/shared";
import { exchangeCodeForToken, getJwt } from "@evevault/shared/auth";
import {
  getCurrentTenantId,
  getTenantConfig,
  useDeviceStore,
  useTenantStore,
} from "@evevault/shared/stores";
import { isLocalnetChain, KeeperMessageTypes } from "@evevault/shared/types";
import { createLogger } from "@evevault/shared/utils";
import { Ed25519PublicKey } from "@mysten/sui/keypairs/ed25519";
import { decodeJwt } from "jose";
import type { IdTokenClaims } from "oidc-client-ts";
import { getAuthUrl } from "@/lib/background/services/oauthService";
import { openPopupWindow } from "@/lib/background/services/popupWindow";
import type { MessageWithId } from "@/lib/background/types";
import { sendToKeeper } from "../vaultHandlers";
import {
  ensureMessageId,
  getCurrentChain,
  sendAuthSuccessToTab,
} from "./authHelpers";
import {
  checkKeeperUnlocked,
  getEphemeralKeyPairSecretKeyFromStorage,
} from "./keeperHelpers";
import {
  addPendingDappId,
  clearPendingAuth,
  getPending,
  KEEPER_RETRY_DELAY_MS,
  setPendingAuthAfterUnlock,
  setPendingAuthWindowId,
} from "./pendingAuth";

const log = createLogger();

export async function handleDappLogin(
  message: MessageWithId,
  _sender: chrome.runtime.MessageSender,
  _sendResponse: (response?: unknown) => void,
  tabId?: number,
): Promise<void> {
  const id = ensureMessageId(message);
  const additionalIds: string[] =
    (message as MessageWithId & { additionalIds?: string[] }).additionalIds ??
    [];

  const tenant = useTenantStore.getState().tenantId;

  const clientId = getTenantConfig(tenant).clientId;
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

      if (typeof tabId === "number") {
        const pending = getPending();
        if (
          pending?.type === "dapp" &&
          pending.tabId === tabId &&
          addPendingDappId(tabId, id)
        ) {
          log.debug("Connect deduplicated for tab", { tabId, id });
          return;
        }
      }

      useDeviceStore.setState({ isLocked: true });
      if (hasDeviceData) {
        // Set pending before opening popup so concurrent auto-connect/connect
        // requests can dedupe against this in-flight unlock flow.
        setPendingAuthAfterUnlock(id, "dapp", tabId);
      }

      const windowId = await openPopupWindow("popup");
      if (windowId === undefined) {
        log.warn("Failed to open vault popup window");
        if (hasDeviceData) {
          clearPendingAuth();
          if (typeof tabId === "number") {
            chrome.tabs.sendMessage(tabId, {
              id,
              type: "auth_error",
              error: {
                message: "Failed to open vault window. Please try again.",
              },
            });
          }
          return;
        }
      } else if (hasDeviceData) {
        setPendingAuthWindowId(id, windowId);
      }

      if (hasDeviceData) {
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
  }

  const deviceWithPublicKey = useDeviceStore.getState();
  if (!deviceWithPublicKey.ephemeralPublicKey) {
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
    if (isLocalnetChain(chain)) {
      const response = await sendToKeeper({
        type: KeeperMessageTypes.LOCALNET_GET_ADDRESS,
      });

      log.debug(
        "Connect: localnet, sending auth_success with localnet address",
      );

      if (response?.ok && response?.address) {
        sendAuthSuccessToTab(
          tabId,
          [id, ...additionalIds],
          { address: response.address },
          chain,
        );
      }
      return;
    }

    const existingJwt = await getJwt();
    if (existingJwt?.id_token) {
      const decodedJwt = decodeJwt<IdTokenClaims>(
        existingJwt.id_token as string,
      );
      log.debug(
        "Connect: already connected, sending auth_success without OIDC",
      );
      const token = {
        ...existingJwt,
        email: decodedJwt.email,
        userId: decodedJwt.sub,
      };
      sendAuthSuccessToTab(tabId, [id, ...additionalIds], token);
      return;
    }
  }

  let nonce = useDeviceStore.getState().networkData[chain]?.nonce;
  if (!nonce) {
    try {
      await useDeviceStore.getState().initializeForChain(chain);
    } catch (error) {
      log.error("Failed to initialize device data for chain", { chain, error });
      if (typeof tabId === "number") {
        chrome.tabs.sendMessage(tabId, {
          id,
          type: "auth_error",
          error: { message: "Could not prepare sign-in. Please try again." },
        });
      }
      return;
    }
    nonce = useDeviceStore.getState().networkData[chain]?.nonce;
  }
  if (!nonce) {
    if (typeof tabId === "number") {
      chrome.tabs.sendMessage(tabId, {
        id,
        type: "auth_error",
        error: { message: "Could not prepare sign-in. Please try again." },
      });
    }
    return;
  }

  const authUrl = getAuthUrl({
    tenantId: tenant,
    nonce,
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

      const tenantId = getCurrentTenantId();

      exchangeCodeForToken(authCode, chromeRedirectUri, tenantId)
        .then(async (jwtResponse) => {
          const decodedJwt = decodeJwt<IdTokenClaims>(
            jwtResponse.id_token as string,
          );
          await storeJwt(jwtResponse);

          if (typeof tabId === "number") {
            const token = {
              ...jwtResponse,
              email: decodedJwt.email,
              userId: decodedJwt.sub,
            };
            sendAuthSuccessToTab(tabId, [id, ...additionalIds], token, log);
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
