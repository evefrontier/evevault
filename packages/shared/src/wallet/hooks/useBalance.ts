import { SUI_DEVNET_CHAIN, type SuiChain } from "@mysten/wallet-standard";
import { formatSUI } from "@suiet/wallet-kit";
import { useQuery } from "@tanstack/react-query";
import type { User } from "oidc-client-ts";
import { useMemo } from "react";
import { createSuiClient } from "../../sui";
import { createLogger, formatByDecimals } from "../../utils";

const log = createLogger();
const SUI_COIN_TYPE = "0x2::sui::SUI";

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
              if (!metadata) {
                return null;
              }
              return {
                decimals: metadata.decimals,
                symbol: metadata.symbol,
                name: metadata.name,
                description: metadata.description,
                iconUrl: metadata.iconUrl,
              };
            });

      const balance = await suiClient.getBalance({
        owner: address,
        coinType,
      });

      const metadata = await metadataPromise;
      log.debug("Balance fetched successfully", {
        totalBalance: balance.totalBalance,
        coinType,
      });

      let formattedBalance: string;
      if (coinType === SUI_COIN_TYPE) {
        formattedBalance = formatSUI(balance.totalBalance);
      } else if (metadata?.decimals !== undefined) {
        formattedBalance = formatByDecimals(
          balance.totalBalance,
          metadata.decimals,
        );
      } else {
        formattedBalance = balance.totalBalance;
      }

      return {
        rawBalance: balance.totalBalance,
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
