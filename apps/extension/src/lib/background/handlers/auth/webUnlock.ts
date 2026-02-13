import { storeJwt } from "@evevault/shared";
import { useNetworkStore } from "@evevault/shared/stores";
import { createLogger } from "@evevault/shared/utils";
import { decodeJwt } from "jose";
import type { IdTokenClaims } from "oidc-client-ts";
import type { WebUnlockMessage } from "../../types";
import { ensureMessageId } from "./authHelpers";

const log = createLogger();

export async function handleWebUnlock(
  message: WebUnlockMessage,
  _sender: chrome.runtime.MessageSender,
  _sendResponse: (response?: unknown) => void,
): Promise<void> {
  log.info("Evefrontier web unlock request");

  const { jwt, tabId } = message;
  const id = ensureMessageId(message);

  const decodedJwt = decodeJwt<IdTokenClaims>(jwt.id_token as string);
  const network = useNetworkStore.getState().chain;

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
