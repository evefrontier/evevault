import { isLocalnetChain } from "@/types/networks";

/**
 * Generates a Suiscan URL for a transaction.
 * For localnet, returns a custom Suiscan account URL when address and localnetUrl are provided.
 */
export function getSuiscanUrl(
  chain: string,
  txDigest: string,
  opts?: { localnetUrl?: string },
): string {
  if (isLocalnetChain(chain) && opts?.localnetUrl) {
    return `https://custom.suiscan.xyz/custom/tx/${txDigest}?network=${encodeURIComponent(opts.localnetUrl)}`;
  }
  const network = chain.replace("sui:", "");
  return `https://suiscan.xyz/${network}/tx/${txDigest}`;
}
