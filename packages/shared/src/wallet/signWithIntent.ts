import type { IntentScope, SignatureWithBytes } from "@mysten/sui/cryptography";
import type { RawSignParams } from "#/types";
import { createLogger } from "#/utils/logger";

const log = createLogger();

/**
 * Signs message bytes with a key pair.
 * Works with any Signer implementation (Ed25519Keypair, WebCryptoSigner, etc.)
 */
export const signWithIntent = async (
  messageBytes: Uint8Array,
  scope: IntentScope,
  params: RawSignParams,
): Promise<{ bytes: string; userSignature: string }> => {
  const { sui_address, keypair } = params;

  if (!sui_address) {
    throw new Error("[signWithIntent] User address not found");
  }

  if (!keypair) {
    throw new Error("[signWithIntent] Key pair not found");
  }

  log.info("[signWithIntent] Signing payload with key", { scope });

  let rawSignature: SignatureWithBytes | undefined;
  try {
    if (scope === "TransactionData") {
      rawSignature = await keypair.signTransaction(messageBytes);
      log.debug("[signWithIntent] Signed transaction bytes with key", {
        byteLength: messageBytes.length,
      });
    } else {
      rawSignature = await keypair.signPersonalMessage(messageBytes);
      log.debug("[signWithIntent] Signed personal message bytes with key", {
        byteLength: messageBytes.length,
      });
    }
  } catch (error) {
    log.error("Error signing message", error);
    throw new Error("Error signing message");
  }

  if (!rawSignature?.bytes || !rawSignature?.signature) {
    throw new Error("[signWithIntent] Signer returned no signature");
  }

  return {
    bytes: rawSignature.bytes,
    userSignature: rawSignature.signature,
  };
};
