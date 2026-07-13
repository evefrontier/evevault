import {
  type AddressAliasesInfo,
  getAddressAliases,
} from '@evefrontier/wallet-core/address-alias'
import { useQuery } from '@tanstack/react-query'
import { createLogger } from '#/utils'

const log = createLogger()

const EMPTY: AddressAliasesInfo = { enabled: false, addressAliases: [] }

/**
 * React-query wrapper around wallet-core's `getAddressAliases`, matching the
 * `useBalance` / `useTransactionHistory` read convention.
 */
export function useAddressAliasesQuery({
  owner,
  suiClient,
  chain,
  enabled = true,
}: {
  owner: string | null | undefined
  suiClient: Parameters<typeof getAddressAliases>[0] // SuiGrpcClient, extracted from the first parameter of getAddressAliases
  chain?: string
  enabled?: boolean
}) {
  return useQuery<AddressAliasesInfo>({
    queryKey: ['address-aliases', owner, chain],
    queryFn: async () => {
      if (!owner) {
        return EMPTY
      }
      try {
        return await getAddressAliases(suiClient, owner)
      } catch (err) {
        log.error('Failed to read address aliases', err)
        throw err
      }
    },
    enabled: enabled && !!owner,
    staleTime: 1000 * 30,
    retry: false,
    refetchOnMount: 'always',
  })
}
