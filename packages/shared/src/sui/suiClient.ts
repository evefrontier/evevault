import { SuiGrpcClient } from "@mysten/sui/grpc";
import { SUI_DEVNET_CHAIN, type SuiChain } from "@mysten/wallet-standard";
import { NETWORKS } from "./networks";

export const createSuiClient = (
  network: SuiChain = SUI_DEVNET_CHAIN,
): SuiGrpcClient => {
  const chainName = network.replace("sui:", "") as
    | "mainnet"
    | "testnet"
    | "devnet"
    | "localnet";

  const networkInfo = NETWORKS[chainName];

  return new SuiGrpcClient({
    network: chainName,
    baseUrl: networkInfo.fullnodeUrl,
  });
};
