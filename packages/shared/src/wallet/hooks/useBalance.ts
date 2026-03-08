import { SUI_TESTNET_CHAIN } from "@mysten/wallet-standard";
import { formatSUI } from "@suiet/wallet-kit";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { createSuiGraphQLClient } from "../../sui/graphqlClient";
import {
  EVE_TESTNET_COIN_TYPE,
  formatByDecimals,
  SUI_COIN_TYPE,
} from "../../utils";
import { BALANCE_AND_METADATA_QUERY } from "../queries/balance";
import type { BalanceAndMetadataResponse } from "../types/graphql";
import type {
  BalanceMetadata,
  CoinBalanceResult,
  UseBalanceParams,
} from "../types/hooks";
import {
  DEFAULT_EVE_TESTNET_METADATA,
  DEFAULT_SUI_METADATA,
} from "../utils/balanceMetadata";

export type { CoinBalanceResult };

export function useBalance({
  user,
  chain,
  coinType = SUI_COIN_TYPE,
}: UseBalanceParams) {
  const currentChain = chain || SUI_TESTNET_CHAIN;
  const graphqlClient = useMemo(
    () => createSuiGraphQLClient(currentChain),
    [currentChain],
  );

  return useQuery<CoinBalanceResult>({
    queryKey: ["coin-balance", user?.profile?.sui_address, chain, coinType],
    queryFn: async () => {
      if (!user?.profile?.sui_address || !graphqlClient) {
        throw new Error("Missing user address or client");
      }

      const address = user.profile.sui_address as string;

      const result = await graphqlClient.query<BalanceAndMetadataResponse>({
        query: BALANCE_AND_METADATA_QUERY,
        variables: { address, coinType },
      });

      if (result.errors?.length) {
        const message = result.errors.map((e) => e.message).join(", ");
        throw new Error(`GraphQL balance query failed: ${message}`);
      }

      let totalBalance = result.data?.address?.balance?.totalBalance ?? "0";
      if (typeof totalBalance !== "string") {
        totalBalance = String(totalBalance);
      }

      const meta = result.data?.coinMetadata;

      const metadata: BalanceMetadata | null =
        coinType === SUI_COIN_TYPE
          ? DEFAULT_SUI_METADATA
          : coinType === EVE_TESTNET_COIN_TYPE
            ? DEFAULT_EVE_TESTNET_METADATA
            : meta && meta.decimals != null && meta.symbol != null
              ? {
                  decimals: meta.decimals,
                  symbol: meta.symbol,
                  name: meta.name ?? "",
                  description: meta.description ?? null,
                  iconUrl: meta.iconUrl ?? null,
                }
              : null;

      let formattedBalance: string;
      if (coinType === SUI_COIN_TYPE) {
        formattedBalance = formatSUI(totalBalance);
      } else if (metadata?.decimals !== undefined) {
        formattedBalance = formatByDecimals(totalBalance, metadata.decimals);
      } else {
        formattedBalance = totalBalance;
      }

      return {
        rawBalance: totalBalance,
        formattedBalance,
        metadata,
        coinType,
      };
    },
    enabled:
      !!user?.profile?.sui_address && !!chain && !!graphqlClient && !!coinType,
    staleTime: 1000 * 30, // 30 seconds
    retry: 2,
  });
}
