import { SuiGrpcClient } from "@mysten/sui/grpc";
import { SUI_TESTNET_CHAIN, type SuiChain } from "@mysten/wallet-standard";
import { NETWORKS } from "./networks";

/** Creates a Sui gRPC client for the specified network. Default matches useNetworkStore.getInitialChain(). */
export const createSuiClient = (
  network: SuiChain = SUI_TESTNET_CHAIN,
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
