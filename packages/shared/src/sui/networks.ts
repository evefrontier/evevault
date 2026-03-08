import type { SuiChain } from "@mysten/wallet-standard";

export const NETWORKS = {
  devnet: {
    fullnodeUrl: "https://fullnode.devnet.sui.io",
    faucetUrl: "https://faucet.sui.io/?network=devnet",
  },
  testnet: {
    fullnodeUrl: "https://fullnode.testnet.sui.io",
    faucetUrl: "https://faucet.sui.io/?network=testnet",
  },
  mainnet: {
    fullnodeUrl: "https://fullnode.mainnet.sui.io",
    faucetUrl: null,
  },
  localnet: {
    fullnodeUrl: "",
    faucetUrl: null,
  },
} as const;

type NetworkKey = keyof typeof NETWORKS;

/**
 * Returns the faucet URL for the given chain, or null if the network has no faucet (e.g. mainnet).
 * Use for "Faucet test SUI" / dev-mode links so the user is sent to the correct network.
 */
export function getFaucetUrlForChain(
  chain: SuiChain | null | undefined,
): string | null {
  if (!chain || typeof chain !== "string") return null;
  const key = chain.replace(/^sui:/, "") as NetworkKey;
  const config = NETWORKS[key];
  return config?.faucetUrl ?? null;
}
