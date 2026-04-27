import { SuiGrpcClient } from "@mysten/sui/grpc";
import {
  SUI_LOCALNET_CHAIN,
  SUI_TESTNET_CHAIN,
  type SuiChain,
} from "@mysten/wallet-standard";
import { NETWORKS } from "./networks";

/**
 * Creates a Sui gRPC client for the specified network.
 * For localnet, pass localnetUrl explicitly (stored in network store); the static
 * NETWORKS.localnet entry has no URL since it is user-configured.
 */
export const createSuiClient = (
  network: SuiChain = SUI_TESTNET_CHAIN,
  localnetUrl?: string,
): SuiGrpcClient => {
  const chainName = network.replace("sui:", "") as
    | "mainnet"
    | "testnet"
    | "devnet"
    | "localnet";

  const baseUrl =
    network === SUI_LOCALNET_CHAIN
      ? (localnetUrl ?? NETWORKS.localnet.fullnodeUrl)
      : NETWORKS[chainName].fullnodeUrl;

  return new SuiGrpcClient({
    network: chainName,
    baseUrl,
  });
};
