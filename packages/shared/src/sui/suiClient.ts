import { SuiGrpcClient } from '@mysten/sui/grpc';
import {
  SUI_LOCALNET_CHAIN,
  SUI_TESTNET_CHAIN,
  type SuiChain,
} from '@mysten/wallet-standard';
import { NETWORKS } from './networks';

/**
 * Creates a Sui gRPC client for the specified network.
 * For localnet, pass user-configured localnetUrl explicitly
 * stored in network store
 */
export const createSuiClient = (
  network: SuiChain = SUI_TESTNET_CHAIN,
  localnetUrl?: string,
): SuiGrpcClient => {
  const chainName = network.replace('sui:', '') as
    | 'mainnet'
    | 'testnet'
    | 'devnet'
    | 'localnet';

  const baseUrl =
    network === SUI_LOCALNET_CHAIN
      ? (() => {
          const configuredUrl = localnetUrl?.trim();
          if (!configuredUrl) {
            throw new Error(
              '[createSuiClient] requires a non-empty localnetUrl when using SUI_LOCALNET_CHAIN.',
            );
          }
          return configuredUrl;
        })()
      : NETWORKS[chainName].fullnodeUrl;

  return new SuiGrpcClient({
    network: chainName,
    baseUrl,
  });
};
