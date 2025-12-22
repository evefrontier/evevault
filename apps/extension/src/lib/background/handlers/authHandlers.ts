import { getDeviceData, storeToken } from "@evevault/shared";
import { exchangeCodeForToken } from "@evevault/shared/auth";
import type { TokenResponse } from "@evevault/shared/types/authTypes";
import { createLogger } from "@evevault/shared/utils";
import type { SuiChain } from "@mysten/wallet-standard";
import { decodeJwt } from "jose";
import { useNetworkStore } from "node_modules/@evevault/shared/src/stores/networkStore";
import type { IdTokenClaims } from "oidc-client-ts";
import { getAuthUrl } from "../services/oauthService";
import type { MessageWithId, WebUnlockMessage } from "../types";

const log = createLogger();

const ensureMessageId = (message: MessageWithId): string => {
  if (!message.id) {
    throw new Error("Message id is required");
  }
  return message.id;
};

async function handleExtLogin(
  message: MessageWithId,
  _sender: chrome.runtime.MessageSender,
  _sendResponse: (response?: unknown) => void,
): Promise<void> {
  const id = ensureMessageId(message);

  const chain = getCurrentChain();
  const { jwtRandomness, nonce, maxEpoch } = await getDeviceData(chain);

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

        const token = await exchangeCodeForToken(
          authCode,
          chrome.identity.getRedirectURL(),
        );
        await storeToken(token, chain);

        sendAuthSuccess(id, token);
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
        .then((token) => {
          const idToken = decodeJwt<IdTokenClaims>(token.id_token as string);
          const network = useNetworkStore.getState().chain;

          // Store token securely in chrome.storage.local
          chrome.storage.local.set({
            "evevault:jwt": { [network]: token },
          });

          if (typeof tabId === "number") {
            chrome.tabs.sendMessage(tabId, {
              id,
              type: "auth_success",
              token: {
                ...token,
                email: idToken.email,
                userId: idToken.sub,
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

  const { token, tabId } = message;
  const id = ensureMessageId(message);

  const idToken = decodeJwt<IdTokenClaims>(token.id_token as string);
  const network = useNetworkStore.getState().chain;

  // Store token securely in chrome.storage.local
  chrome.storage.local.set({
    "evevault:jwt": { [network]: token },
  });

  if (typeof tabId === "number") {
    chrome.tabs.sendMessage(tabId, {
      id,
      type: "auth_success",
      token: {
        ...token,
        email: idToken.email,
        userId: idToken.sub,
      },
    });
  }
}

// Helper functions
function getCurrentChain(): SuiChain {
  return useNetworkStore.getState().chain;
}

function extractAuthCode(responseUrl: string) {
  return new URL(responseUrl).searchParams.get("code");
}

function sendAuthSuccess(id: string, token: TokenResponse) {
  chrome.runtime.sendMessage({
    id,
    type: "auth_success",
    token: {
      ...token,
      email: extractEmailFromToken(token),
      userId: extractUserIdFromToken(token),
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

function extractEmailFromToken(token: TokenResponse) {
  const decoded = decodeJwt<IdTokenClaims>(token.id_token as string);
  return decoded.email as string;
}

function extractUserIdFromToken(token: TokenResponse) {
  const decoded = decodeJwt<IdTokenClaims>(token.id_token as string);
  return decoded.sub as string;
}

export { handleExtLogin, handleDappLogin, handleWebUnlock };
