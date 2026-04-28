import type { IntentScope } from "@mysten/sui/cryptography";
import { SUI_LOCALNET_CHAIN, type SuiChain } from "@mysten/wallet-standard";
import type { ZkSignAnyParams } from "#/types/wallet";
import { rawSign } from "./rawSign";
import { zkSignAny } from "./zkSignAny";

/**
 * Unified signing entry point. Routes to rawSign (Ed25519) on localnet,
 * zkSignAny (zkLogin) on all other chains.
 */
export async function signForChain(
  scope: IntentScope,
  msgBytes: Uint8Array,
  opts: {
    chain: SuiChain;
    user: ZkSignAnyParams["user"] | null;
    getZkProof: ZkSignAnyParams["getZkProof"] | null;
    localnetAddress?: string | null;
  },
): Promise<{ bytes: string; signature: string }> {
  if (opts.chain === SUI_LOCALNET_CHAIN) {
    if (!opts.localnetAddress) {
      throw new Error(
        "No localnet keypair loaded. Enter your private key in the network selector.",
      );
    }
    return rawSign(scope, msgBytes, opts.localnetAddress);
  }

  if (!opts.user) {
    throw new Error("User not found for current network");
  }

  if (!opts.getZkProof) {
    throw new Error("getZkProof is required for zkLogin signing");
  }

  const { bytes, zkSignature } = await zkSignAny(scope, msgBytes, {
    user: opts.user,
    getZkProof: opts.getZkProof,
  });
  return { bytes, signature: zkSignature };
}
