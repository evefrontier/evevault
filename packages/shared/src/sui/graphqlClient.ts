import { SuiGraphQLClient } from "@mysten/sui/graphql";
import { SUI_TESTNET_CHAIN, type SuiChain } from "@mysten/wallet-standard";

/**
 * GraphQL Beta endpoint URLs per network
 * Reference: https://docs.sui.io/concepts/data-access/graphql-rpc
 */
const GRAPHQL_ENDPOINTS: Record<string, string> = {
  mainnet: "https://graphql.mainnet.sui.io/graphql",
  testnet: "https://graphql.testnet.sui.io/graphql",
  devnet: "https://graphql.devnet.sui.io/graphql",
};

/**
 * Creates a Sui GraphQL client for the specified network.
 * Default SUI_TESTNET_CHAIN is intentional and matches useNetworkStore.getInitialChain().
 * Callers should pass the store's chain when available so queries use the selected network.
 */
export function createSuiGraphQLClient(
  network: SuiChain = SUI_TESTNET_CHAIN,
): SuiGraphQLClient {
  const chainName = network.replace("sui:", "") as
    | "mainnet"
    | "testnet"
    | "devnet";

  const url = GRAPHQL_ENDPOINTS[chainName] || GRAPHQL_ENDPOINTS.devnet;

  return new SuiGraphQLClient({
    url,
    network: chainName,
  });
}
