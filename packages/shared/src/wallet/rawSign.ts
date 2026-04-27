import type { IntentScope } from "@mysten/sui/cryptography";
import { VaultMessageTypes } from "../types/messages";
import { isWeb } from "../utils/environment";
import { createLogger } from "../utils/logger";

const log = createLogger();

/**
 * Signs bytes directly with the localnet keypair held in the keeper.
 * Produces a plain Ed25519 signature — no ZK proof, no zkLogin wrapper.
 * Extension-only: localnet signing is not supported on the web app path.
 */
export async function rawSign(
  scope: IntentScope,
  msgBytes: Uint8Array,
  suiAddress: string,
): Promise<{ bytes: string; signature: string }> {
  if (isWeb()) {
    throw new Error("rawSign is only available in the extension (localnet)");
  }

  log.info("rawSign: requesting direct signature from keeper", { scope });

  const response = (await chrome.runtime?.sendMessage?.({
    type: VaultMessageTypes.LOCALNET_SIGN_BYTES,
    msgBytes: Array.from(msgBytes),
    scope,
    suiAddress,
  })) as
    | { ok?: boolean; bytes?: string; signature?: string; error?: string }
    | undefined;

  if (!response?.ok || !response.bytes || !response.signature) {
    throw new Error(response?.error ?? "rawSign: no response from keeper");
  }

  return { bytes: response.bytes, signature: response.signature };
}
