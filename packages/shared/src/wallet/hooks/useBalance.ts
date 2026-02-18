import { SUI_DEVNET_CHAIN, type SuiChain } from "@mysten/wallet-standard";
import { formatSUI } from "@suiet/wallet-kit";
import { useQuery } from "@tanstack/react-query";
import type { User } from "oidc-client-ts";
import { useMemo } from "react";
import { createSuiClient } from "../../sui";
import { createLogger, formatByDecimals, SUI_COIN_TYPE } from "../../utils";

const log = createLogger();

interface UseBalanceParams {
  user: User | null;
  chain: SuiChain | null;
  coinType?: string;
}

interface BalanceMetadata {
  decimals: number;
  symbol: string;
  name: string;
  description?: string | null;
  iconUrl?: string | null;
}

export interface CoinBalanceResult {
  rawBalance: string;
  formattedBalance: string;
  metadata: BalanceMetadata | null;
  coinType: string;
}

const DEFAULT_SUI_METADATA: BalanceMetadata = {
  decimals: 9,
  symbol: "SUI",
  name: "Sui",
  description: "Sui Native Token",
  iconUrl: "",
};

export function useBalance({
  user,
  chain,
  coinType = SUI_COIN_TYPE,
}: UseBalanceParams) {
  const suiClient = useMemo(() => {
    const currentChain = chain || SUI_DEVNET_CHAIN;
    return createSuiClient(currentChain);
  }, [chain]);

  return useQuery<CoinBalanceResult>({
    queryKey: ["coin-balance", user?.profile?.sui_address, chain, coinType],
    queryFn: async () => {
      if (!user?.profile?.sui_address || !suiClient) {
        throw new Error("Missing user address or client");
      }

      const address = user.profile.sui_address as string;
      log.debug("Fetching balance", { address, chain });

      const metadataPromise: Promise<BalanceMetadata | null> =
        coinType === SUI_COIN_TYPE
          ? Promise.resolve(DEFAULT_SUI_METADATA)
          : suiClient.getCoinMetadata({ coinType }).then((metadata) => {
              if (!metadata?.coinMetadata) {
                return null;
              }
              return {
                decimals: metadata.coinMetadata.decimals,
                symbol: metadata.coinMetadata.symbol,
                name: metadata.coinMetadata.name,
                description: metadata.coinMetadata.description,
                iconUrl: metadata.coinMetadata.iconUrl,
              };
            });

      const { balance } = await suiClient.getBalance({
        owner: address,
        coinType,
      });

      const metadata = await metadataPromise;
      log.debug("Balance fetched successfully", {
        totalBalance: balance.balance,
        coinType,
      });

      let formattedBalance: string;
      if (coinType === SUI_COIN_TYPE) {
        formattedBalance = formatSUI(balance.balance);
      } else if (metadata?.decimals !== undefined) {
        formattedBalance = formatByDecimals(balance.balance, metadata.decimals);
      } else {
        formattedBalance = balance.balance;
      }

      return {
        rawBalance: balance.balance,
        formattedBalance,
        metadata,
        coinType,
      };
    },
    enabled:
      !!user?.profile?.sui_address && !!chain && !!suiClient && !!coinType,
    staleTime: 1000 * 30, // 30 seconds
    retry: 2,
  });
}
