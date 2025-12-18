import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { SUI_DEVNET_CHAIN, type SuiChain } from "@mysten/wallet-standard";

export const createSuiClient = (
  network: SuiChain = SUI_DEVNET_CHAIN,
): SuiClient => {
  const chainName = network.replace("sui:", "") as
    | "mainnet"
    | "testnet"
    | "devnet"
    | "localnet";

  return new SuiClient({
    url: getFullnodeUrl(chainName),
  });
};
