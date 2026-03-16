import { SUI_TESTNET_CHAIN } from "@mysten/wallet-standard";
import { formatSUI } from "@suiet/wallet-kit";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { createSuiGraphQLClient } from "../../sui/graphqlClient";
<<<<<<< feat/balance-updates
import {
  EVE_TESTNET_COIN_TYPE,
  formatByDecimals,
  SUI_COIN_TYPE,
} from "../../utils";
import { createLogger } from "../../utils/logger";
import {
  BALANCE_AND_METADATA_QUERY,
  LATEST_CHECKPOINT_QUERY,
} from "../queries/balance";
import type {
  BalanceAndMetadataResponse,
  LatestCheckpointResponse,
} from "../types/graphql";
=======
import { formatByDecimals, SUI_COIN_TYPE } from "../../utils";
import { isEveCoinType } from "../eveToken";
import { BALANCE_AND_METADATA_QUERY } from "../queries/balance";
import type { BalanceAndMetadataResponse } from "../types/graphql";
>>>>>>> main
import type {
  BalanceMetadata,
  CoinBalanceResult,
  UseBalanceParams,
} from "../types/hooks";
import {
  DEFAULT_EVE_TESTNET_METADATA,
  DEFAULT_SUI_METADATA,
} from "../utils/balanceMetadata";

const log = createLogger();

export type { CoinBalanceResult };

async function fetchBalanceWithCheckpoint(
  graphqlClient: ReturnType<typeof createSuiGraphQLClient>,
  address: string,
  coinType: string,
): Promise<BalanceAndMetadataResponse | null> {
  const checkpointRes = await graphqlClient.query<LatestCheckpointResponse>({
    query: LATEST_CHECKPOINT_QUERY,
    variables: {},
  });

  if (checkpointRes.errors?.length) {
    log.error("LatestCheckpoint GraphQL query returned errors", {
      errors: checkpointRes.errors,
    });
  }

  const raw = checkpointRes.data?.checkpoint?.sequenceNumber;
  const parsed =
    raw != null ? (typeof raw === "number" ? raw : Number(raw)) : undefined;
  const atCheckpoint =
    parsed != null &&
    !Number.isNaN(parsed) &&
    Number.isSafeInteger(parsed) &&
    parsed <= Number.MAX_SAFE_INTEGER
      ? parsed
      : undefined;
  if (atCheckpoint == null && raw != null) {
    log.debug(
      "Checkpoint sequenceNumber out of safe integer range or invalid, querying balance without atCheckpoint",
      { raw },
    );
  } else if (atCheckpoint == null) {
    log.debug(
      "Latest checkpoint unavailable, querying balance without atCheckpoint",
    );
  }

  const result = await graphqlClient.query<BalanceAndMetadataResponse>({
    query: BALANCE_AND_METADATA_QUERY,
    variables: { address, coinType, atCheckpoint },
  });

  if (result.errors?.length) {
    const message = result.errors.map((e) => e.message).join(", ");
    throw new Error(`GraphQL balance query failed: ${message}`);
  }

  return result.data ?? null;
}

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

      let data: BalanceAndMetadataResponse | null = null;
      try {
        data = await fetchBalanceWithCheckpoint(
          graphqlClient,
          address,
          coinType,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.toLowerCase().includes("outside consistent range")) {
          data = await fetchBalanceWithCheckpoint(
            graphqlClient,
            address,
            coinType,
          );
        } else {
          throw err;
        }
      }

      let totalBalance = data?.address?.balance?.totalBalance ?? "0";
      if (typeof totalBalance !== "string") {
        totalBalance = String(totalBalance);
      }

      const meta = data?.coinMetadata;

      const metadata: BalanceMetadata | null =
        coinType === SUI_COIN_TYPE
          ? DEFAULT_SUI_METADATA
          : isEveCoinType(coinType)
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
    retry: false,
    refetchOnMount: "always",
  });
}
