import { ephSign } from "@evevault/shared";
import type { IntentScope } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { BackgroundMessage } from "@/lib/background/types";

type LocalnetState = {
  localnetKey: Ed25519Keypair | null;
};

const localnetSetKeypair = async (
  state: LocalnetState,
  message: BackgroundMessage,
  sendResponse: (response: {
    ok: boolean;
    address?: string;
    error?: string;
  }) => void,
) => {
  try {
    const { privateKey } = message as { privateKey?: string };

    if (!privateKey) {
      sendResponse({ ok: false, error: "privateKey required" });
      return;
    }

    // suiprivkey1... (Bech32): SDK handles this directly
    if (privateKey.startsWith("suiprivkey")) {
      state.localnetKey = Ed25519Keypair.fromSecretKey(privateKey);
    } else {
      throw new Error("Invalid private key");
    }

    sendResponse({
      ok: true,
      address: state.localnetKey.getPublicKey().toSuiAddress(),
    });
  } catch (error) {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

const localnetGetAddress = (
  state: LocalnetState,
  sendResponse: (response: {
    ok: boolean;
    address?: string | null;
    error?: string;
  }) => void,
) => {
  if (!state.localnetKey) {
    sendResponse({ ok: true, address: null });
  } else {
    sendResponse({
      ok: true,
      address: state.localnetKey.getPublicKey().toSuiAddress(),
    });
  }
};

const localnetSign = async (
  state: LocalnetState,
  message: BackgroundMessage,
  sendResponse: (response: {
    ok: boolean;
    bytes?: string;
    signature?: string;
    error?: string;
  }) => void,
) => {
  const key = state.localnetKey;
  if (!key) {
    sendResponse({ ok: false, error: "No localnet keypair loaded" });
    return;
  }

  try {
    const { msgBytes, scope, suiAddress } = message as {
      msgBytes: number[];
      scope: IntentScope;
      suiAddress: string;
    };

    const messageBytes = new Uint8Array(msgBytes);
    const result = await ephSign(messageBytes, scope, {
      sui_address: suiAddress,
      ephemeralKeyPair: key,
    });

    sendResponse({
      ok: true,
      bytes: result.bytes,
      signature: result.userSignature,
    });
  } catch (error) {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export type { LocalnetState };
export { localnetSetKeypair, localnetGetAddress, localnetSign };
