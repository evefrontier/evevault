import { SUI_TESTNET_CHAIN } from '@mysten/wallet-standard'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { createSuiGraphQLClient } from '#/sui/graphqlClient'
import { isLocalnetChain } from '#/types/networks'
import { SUI_COIN_TYPE } from '#/utils'
import type { CoinBalanceResult, UseBalanceParams } from '#/wallet/types/hooks'
import { fetchBalanceForChain } from './useBalance.helpers'

export type { CoinBalanceResult }

export function useBalance({
  user,
  chain,
  coinType = SUI_COIN_TYPE,
  address: addressOverride,
  localnetUrl,
}: UseBalanceParams) {
  const currentChain = chain || SUI_TESTNET_CHAIN
  const isLocalnet = isLocalnetChain(currentChain)

  const activeAddress =
    addressOverride ||
    (user?.profile?.sui_address as string | undefined) ||
    null

  const graphqlClient = useMemo(
    () => (isLocalnet ? null : createSuiGraphQLClient(currentChain)),
    [currentChain, isLocalnet],
  )

  return useQuery<CoinBalanceResult>({
    queryKey: ['coin-balance', activeAddress, chain, coinType, localnetUrl],
    queryFn: async () => {
      if (!activeAddress) {
        throw new Error('Missing address')
      }

      return fetchBalanceForChain({
        activeAddress,
        coinType,
        isLocalnet,
        localnetUrl,
        graphqlClient,
      })
    },
    enabled:
      !!activeAddress &&
      !!chain &&
      !!coinType &&
      (!isLocalnet || !!localnetUrl),
    staleTime: 1000 * 30,
    retry: false,
    refetchOnMount: 'always',
  })
}
