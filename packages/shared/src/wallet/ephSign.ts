import type { EphSignParams } from "@evevault/shared/types";
import {
  type IntentScope,
  messageWithIntent,
  type SignatureWithBytes,
} from "@mysten/sui/cryptography";
import { toBase64 } from "@mysten/sui/utils";
import { createLogger } from "../utils/logger";

const log = createLogger();

/**
 * Signs message bytes with an ephemeral key pair.
 * Works with any Signer implementation (Ed25519Keypair, WebCryptoSigner, etc.)
 */
export const ephSign = async (
  messageBytes: Uint8Array,
  scope: IntentScope,
  params: EphSignParams,
): Promise<{ bytes: string; userSignature: string }> => {
  const { sui_address, ephemeralKeyPair } = params;

  if (!sui_address) {
    throw new Error("User address not found");
  }

  if (!ephemeralKeyPair) {
    throw new Error("Ephemeral key pair not found");
  }

  log.info("Signing payload with ephemeral key", { scope });

  let ephSignature: SignatureWithBytes | undefined;
  try {
    if (scope === "TransactionData") {
      ephSignature = await ephemeralKeyPair.signTransaction(messageBytes);
      log.debug("Signed transaction bytes with ephemeral key", {
        byteLength: messageBytes.length,
      });
    } else {
      const messageBytesWithIntent = messageWithIntent(scope, messageBytes);

      const messageSignature = await ephemeralKeyPair.sign(messageBytes);
      log.debug("Signed message bytes with ephemeral key", {
        byteLength: messageBytes.length,
      });

      if (!messageSignature) {
        throw new Error("Message signature not found");
      }

      ephSignature = {
        bytes: toBase64(messageBytesWithIntent),
        signature: toBase64(messageSignature),
      };
    }
  } catch (error) {
    log.error("Error signing transaction", error);
    throw new Error("Error signing transaction");
  }

  if (ephSignature === undefined) {
    throw new Error("Signature not found");
  }

  return {
    bytes: ephSignature.bytes,
    userSignature: ephSignature.signature,
  };
};
