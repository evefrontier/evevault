import type { IntentScope } from "@mysten/sui/cryptography";
import { genAddressSeed, getZkLoginSignature } from "@mysten/sui/zklogin";
import { ephKeyService } from "../services/vaultService";
import { VaultMessageTypes } from "../types/messages";
import type { PartialZkLoginSignature, ZkSignAnyParams } from "../types/wallet";
import { isWeb } from "../utils/environment";
import { createLogger } from "../utils/logger";
import { ephSign } from "./ephSign";

const log = createLogger();

/**
 * Signs either a message or transaction with zkLogin depending on the intent scope.
 * Works with both extension (Ed25519 via background script) and web (Secp256r1 via WebCrypto).
 */
export const zkSignAny = async (
  scope: IntentScope,
  msgBytes: Uint8Array,
  params: ZkSignAnyParams,
): Promise<{ zkSignature: string; bytes: string }> => {
  const { user, ephemeralPublicKey, maxEpoch, getZkProof } = params;

  if (user === null) {
    throw new Error("User not found");
  }

  if (!ephemeralPublicKey) {
    throw new Error("Ephemeral key pair not found");
  }

  if (maxEpoch === null) {
    throw new Error("Max epoch is not set");
  }

  log.info("Getting ZK proof");
  const zkProof = await getZkProof();
  if (!zkProof || zkProof.error) {
    const errorMsg =
      typeof zkProof?.error === "string"
        ? zkProof.error
        : (zkProof?.error?.message ?? "Failed to get ZK proof");
    throw new Error(errorMsg);
  }

  log.info("Requesting ephemeral signature");

  let bytes: string;
  let userSignature: string;

  if (isWeb()) {
    // Web: Use WebCryptoSigner directly
    const signer = ephKeyService.getSigner();
    if (!signer) {
      throw new Error("Vault is locked or no keypair exists");
    }

    const sui_address = user.profile?.sui_address as string;
    const signResult = await ephSign(msgBytes, scope, {
      sui_address,
      ephemeralKeyPair: signer,
    });

    bytes = signResult.bytes;
    userSignature = signResult.userSignature;
  } else {
    // Extension: Use background script
    const response = (await chrome.runtime?.sendMessage?.({
      type: VaultMessageTypes.ZK_EPH_SIGN_BYTES,
      msgBytes: Array.from(msgBytes), // Convert Uint8Array to array for serialization
      scope,
      sui_address: user.profile?.sui_address as string,
    })) as
      | { ok?: boolean; bytes?: string; userSignature?: string; error?: string }
      | undefined;

    if (!response) {
      throw new Error(
        "No response from background script. The extension may not be properly initialized.",
      );
    }

    if (!response.ok || !response.bytes || !response.userSignature) {
      const errorMessage = response.error || "Failed to sign bytes";
      throw new Error(errorMessage);
    }

    bytes = response.bytes;
    userSignature = response.userSignature;
  }

  if (!userSignature) {
    throw new Error("User signature not found");
  }

  const addressSeed = genAddressSeed(
    BigInt(user.profile?.salt as string),
    "sub",
    user.profile?.sub as string,
    user.profile?.aud as string,
  ).toString();

  if (!("data" in zkProof) || !zkProof.data) {
    throw new Error("ZK proof data not found");
  }

  const partialZkLoginSignature = zkProof.data as PartialZkLoginSignature;

  log.info("Combining proof and signature to create zkLogin signature");

  // Important: The zklogin signature cannot be validated with the TS SDK
  // It can only be validated by calling the Sui GraphQL API
  // Expect validations to fail with the TS SDK from the dapp

  const zkSignature = getZkLoginSignature({
    inputs: {
      ...partialZkLoginSignature,
      addressSeed,
    },
    maxEpoch,
    userSignature,
  });

  return { bytes, zkSignature };
};
