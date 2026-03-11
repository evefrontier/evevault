import {
  type IntentScope,
  type SignatureWithBytes,
} from "@mysten/sui/cryptography";
import type { EphSignParams } from "../types";
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
      // Use signPersonalMessage which correctly:
      // 1. BCS-encodes the message bytes
      // 2. Prepends the PersonalMessage intent bytes
      // 3. Hashes with blake2b
      // 4. Signs the hash and returns a serialized signature (flag + sig + pubkey)
      ephSignature = await ephemeralKeyPair.signPersonalMessage(messageBytes);
      log.debug("Signed personal message bytes with ephemeral key", {
        byteLength: messageBytes.length,
      });
    }
  } catch (error) {
    log.error("Error signing message", error);
    throw new Error("Error signing message");
  }

  if (ephSignature === undefined) {
    throw new Error("Signature not found");
  }

  return {
    bytes: ephSignature.bytes,
    userSignature: ephSignature.signature,
  };
};
