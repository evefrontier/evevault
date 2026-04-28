import { SUI_LOCALNET_CHAIN, SUI_TESTNET_CHAIN } from "@mysten/wallet-standard";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { createSuiClient } from "../../sui";
import { createSuiGraphQLClient } from "../../sui/graphqlClient";
import { isLocalnetChain } from "../../types/networks";
import { formatByDecimals, formatMistToSui, SUI_COIN_TYPE } from "../../utils";
import { createLogger } from "../../utils/logger";
import { isEveCoinType } from "../eveToken";
import {
  BALANCE_AND_METADATA_QUERY,
  LATEST_CHECKPOINT_QUERY,
} from "@/wallet/queries/balance";
import type {
  BalanceAndMetadataResponse,
  LatestCheckpointResponse,
} from "@/wallet/types/graphql";
import type {
  BalanceMetadata,
  CoinBalanceResult,
  UseBalanceParams,
} from "@/wallet/types/hooks";
import {
  DEFAULT_EVE_TESTNET_METADATA,
  DEFAULT_SUI_METADATA,
} from "@/wallet/utils/balanceMetadata";

const log = createLogger();

export type { CoinBalanceResult };

async function fetchZkLoginBalanceViaGraphql(
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

async function fetchLocalnetBalanceViaGrpc(
  localnetUrl: string,
  address: string,
  coinType: string,
): Promise<CoinBalanceResult> {
  const client = createSuiClient(SUI_LOCALNET_CHAIN, localnetUrl);
  const result = await client.getBalance({ owner: address, coinType });

  const totalBalance = result.balance?.balance ?? "0";
  let formattedBalance: string;
  if (coinType === SUI_COIN_TYPE) {
    formattedBalance = formatMistToSui(totalBalance);
  } else {
    // Localnet tokens don't have on-chain metadata; default to 9 decimals
    log.warn(
      "fetchLocalnetBalanceViaGrpc: no metadata for coin type, defaulting to 9 decimals",
      { coinType },
    );
    formattedBalance = formatByDecimals(totalBalance, 9);
  }
  return {
    rawBalance: totalBalance,
    formattedBalance,
    metadata: coinType === SUI_COIN_TYPE ? DEFAULT_SUI_METADATA : null,
    coinType,
  };
}

export function useBalance({
  user,
  chain,
  coinType = SUI_COIN_TYPE,
  address: addressOverride,
  localnetUrl,
}: UseBalanceParams) {
  const currentChain = chain || SUI_TESTNET_CHAIN;
  const isLocalnet = isLocalnetChain(currentChain);

  const activeAddress =
    addressOverride ||
    (user?.profile?.sui_address as string | undefined) ||
    null;

  const graphqlClient = useMemo(
    () => (isLocalnet ? null : createSuiGraphQLClient(currentChain)),
    [currentChain, isLocalnet],
  );

  return useQuery<CoinBalanceResult>({
    queryKey: ["coin-balance", activeAddress, chain, coinType, localnetUrl],
    queryFn: async () => {
      if (!activeAddress) {
        throw new Error("Missing address");
      }

      // Localnet: no GraphQL endpoint — use gRPC (same client as useSendToken)
      if (isLocalnet) {
        if (!localnetUrl)
          throw new Error("localnetUrl required for localnet balance");
        return fetchLocalnetBalanceViaGrpc(
          localnetUrl,
          activeAddress,
          coinType,
        );
      }

      if (!graphqlClient) throw new Error("Missing GraphQL client");

      let data: BalanceAndMetadataResponse | null = null;
      try {
        data = await fetchZkLoginBalanceViaGraphql(
          graphqlClient,
          activeAddress,
          coinType,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.toLowerCase().includes("outside consistent range")) {
          data = await fetchZkLoginBalanceViaGraphql(
            graphqlClient,
            activeAddress,
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
        formattedBalance = formatMistToSui(totalBalance);
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
      !!activeAddress &&
      !!chain &&
      !!coinType &&
      (!isLocalnet || !!localnetUrl),
    staleTime: 1000 * 30,
    retry: false,
    refetchOnMount: "always",
  });
}
