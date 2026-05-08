import {
  SUI_DEVNET_CHAIN,
  SUI_MAINNET_CHAIN,
  SUI_TESTNET_CHAIN,
  type SuiChain,
} from "@mysten/wallet-standard";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSuiGraphQLClient } = vi.hoisted(() => ({
  mockSuiGraphQLClient: vi.fn(),
}));

vi.mock("@mysten/sui/graphql", () => ({
  SuiGraphQLClient: mockSuiGraphQLClient,
}));

import { createSuiGraphQLClient } from "#/sui/graphqlClient";

describe("createSuiGraphQLClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each<[SuiChain, string, string]>([
    [SUI_MAINNET_CHAIN, "mainnet", "https://graphql.mainnet.sui.io/graphql"],
    [SUI_TESTNET_CHAIN, "testnet", "https://graphql.testnet.sui.io/graphql"],
    [SUI_DEVNET_CHAIN, "devnet", "https://graphql.devnet.sui.io/graphql"],
  ])("maps %s to its GraphQL endpoint", (chain, network, url) => {
    createSuiGraphQLClient(chain);

    expect(mockSuiGraphQLClient).toHaveBeenCalledWith({ network, url });
  });

  it("falls back to devnet endpoint for an unknown network name", () => {
    createSuiGraphQLClient("sui:unknown" as SuiChain);

    expect(mockSuiGraphQLClient).toHaveBeenCalledWith({
      network: "unknown",
      url: "https://graphql.devnet.sui.io/graphql",
    });
  });

  it("defaults to testnet when no chain argument is provided", () => {
    createSuiGraphQLClient();

    expect(mockSuiGraphQLClient).toHaveBeenCalledWith({
      network: "testnet",
      url: "https://graphql.testnet.sui.io/graphql",
    });
  });
});
