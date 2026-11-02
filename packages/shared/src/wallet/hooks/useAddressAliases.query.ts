import {
  type AddressAliasesInfo,
  getAddressAliases,
} from '@evefrontier/wallet-core/address-alias'
import { type QueryClient, useQuery } from '@tanstack/react-query'
import { createLogger } from '#/utils'

const log = createLogger()

const EMPTY: AddressAliasesInfo = { enabled: false, addressAliases: [] }

const addressAliasesQueryKey = (
  owner: string | null | undefined,
  chain: string | undefined,
) => ['address-aliases', owner, chain] as const

/**
 * Writes a confirmed alias change into the cache instead of refetching. The
 * owned-object read can lag a confirmed write, so a refetch can return the
 * pre-change list. Returning `undefined` from `update` leaves the cache as is.
 */
export async function setAddressAliasesData(
  queryClient: QueryClient,
  owner: string,
  chain: string | undefined,
  update: (
    previous: AddressAliasesInfo | undefined,
  ) => AddressAliasesInfo | undefined,
) {
  const queryKey = addressAliasesQueryKey(owner, chain)
  // Cancel any in-flight read so it can't land after the update.
  await queryClient.cancelQueries({ queryKey })
  queryClient.setQueryData<AddressAliasesInfo>(queryKey, update)
}

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
    queryKey: addressAliasesQueryKey(owner, chain),
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
