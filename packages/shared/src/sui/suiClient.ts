import { SuiGrpcClient } from "@mysten/sui/grpc";
import { SUI_TESTNET_CHAIN, type SuiChain } from "@mysten/wallet-standard";
import { NETWORKS } from "./networks";

/**
 * Creates a Sui gRPC client for the specified network.
 * Default SUI_TESTNET_CHAIN is intentional and matches useNetworkStore.getInitialChain().
 * Callers should pass the store's chain when available so transactions use the selected network.
 */
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
