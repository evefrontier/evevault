import { storeJwt, type TenantId } from "@evevault/shared";
import { exchangeCodeForToken } from "@evevault/shared/auth";
import {
  getCurrentTenantId,
  isAvailableTenantId,
  useDeviceStore,
} from "@evevault/shared/stores";
import { createLogger } from "@evevault/shared/utils";
import { Ed25519PublicKey } from "@mysten/sui/keypairs/ed25519";
import { getAuthUrl } from "@/lib/background/services/oauthService";
import { openPopupWindow } from "@/lib/background/services/popupWindow";
import type { MessageWithId } from "@/lib/background/types";
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

  const tenantId: TenantId =
    typeof message.tenantId === "string" &&
    isAvailableTenantId(message.tenantId)
      ? (message.tenantId as TenantId)
      : getCurrentTenantId();

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
        setPendingAuthAfterUnlock(id, "ext", undefined, windowId, tenantId);
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
  }

  const deviceWithPublicKey = useDeviceStore.getState();
  if (!deviceWithPublicKey.ephemeralPublicKey) {
    log.error("Keeper is unlocked but no public key bytes available", {
      chain: initialChain,
    });
    return sendAuthError(id, {
      message: "Vault state is inconsistent. Please unlock the vault again.",
    });
  }

  const currentChain = await getCurrentChainFromStorage();

  let nonce = useDeviceStore.getState().networkData[currentChain]?.nonce;
  if (!nonce) {
    try {
      await useDeviceStore.getState().initializeForChain(currentChain);
    } catch (error) {
      log.error("Failed to initialize device data for chain", {
        currentChain,
        error,
      });
      return sendAuthError(id, {
        message: "Could not prepare sign-in. Please try again.",
      });
    }
    nonce = useDeviceStore.getState().networkData[currentChain]?.nonce;
  }
  if (!nonce) {
    return sendAuthError(id, {
      message: "Could not prepare sign-in. Please try again.",
    });
  }

  const authUrl = getAuthUrl({
    tenantId: tenantId,
    nonce,
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
          tenantId,
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
