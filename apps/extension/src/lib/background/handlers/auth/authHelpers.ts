import { useNetworkStore } from "@evevault/shared/stores";
import type { JwtResponse } from "@evevault/shared/types";
import { createLogger, NETWORK_STORAGE_KEY } from "@evevault/shared/utils";
import type { SuiChain } from "@mysten/wallet-standard";
import { decodeJwt } from "jose";
import type { IdTokenClaims } from "oidc-client-ts";
import type { MessageWithId } from "../../types";

const log = createLogger();

export function ensureMessageId(message: MessageWithId): string {
  if (!message.id) {
    throw new Error("Message id is required");
  }
  return message.id;
}

export function getCurrentChain(): SuiChain {
  return useNetworkStore.getState().chain;
}

/**
 * Reads the current chain directly from chrome.storage to avoid Zustand sync issues
 * between popup and background script. This ensures we get the most up-to-date network
 * state when storing JWTs during OAuth callbacks.
 */
export async function getCurrentChainFromStorage(): Promise<SuiChain> {
  return new Promise((resolve) => {
    chrome.storage.local.get([NETWORK_STORAGE_KEY], (result) => {
      try {
        const stored = result[NETWORK_STORAGE_KEY];
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
      const fallbackChain = useNetworkStore.getState().chain;
      log.debug("Using fallback chain from Zustand", { chain: fallbackChain });
      resolve(fallbackChain);
    });
  });
}

export function extractAuthCode(responseUrl: string): string | null {
  return new URL(responseUrl).searchParams.get("code");
}

export function sendAuthSuccess(id: string, jwt: JwtResponse): void {
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

export function sendAuthError(id: string, error: unknown): void {
  chrome.runtime.sendMessage({
    id,
    type: "auth_error",
    error,
  });
}

export function extractEmailFromJwt(jwt: JwtResponse): string {
  const decoded = decodeJwt<IdTokenClaims>(jwt.id_token as string);
  return decoded.email as string;
}

export function extractUserIdFromJwt(jwt: JwtResponse): string {
  const decoded = decodeJwt<IdTokenClaims>(jwt.id_token as string);
  return decoded.sub as string;
}
