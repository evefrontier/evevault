import type { SuiGrpcClient } from '@mysten/sui/grpc'
import { useQuery } from '@tanstack/react-query'
import { createLogger } from '#/utils'
import {
  ADDRESS_ALIASES_TYPE,
  type AddressAliasesInfo,
} from './useAliases.config'

const log = createLogger()

const EMPTY: AddressAliasesInfo = { enabled: false, aliases: [] }

/**
 * Reads the caller's `AddressAliases` owned object. Its id isn't known ahead of
 * time (it's minted by `enable`), so we list owned objects filtered by type.
 * Returns `enabled: false` when absent.
 */
export async function getAddressAliases(
  client: SuiGrpcClient,
  owner: string,
): Promise<AddressAliasesInfo> {
  const result = await client.listOwnedObjects({
    owner,
    type: ADDRESS_ALIASES_TYPE,
    include: { json: true },
  })

  const object = result.objects[0]
  if (!object) {
    return EMPTY
  }

  return {
    enabled: true,
    objectId: object.objectId,
    aliases: parseAliases(object.json),
  }
}

/**
 * Defensive parse of the aliases list out of the object's JSON view.
 */
function parseAliases(json: Record<string, unknown> | null): string[] {
  const aliases = (json?.aliases as { contents?: unknown } | undefined)
    ?.contents
  if (!Array.isArray(aliases)) {
    return []
  }
  return aliases.filter((alias): alias is string => typeof alias === 'string')
}

/**
 * React-query wrapper around {@link getAddressAliases}, matching the
 * `useBalance` / `useTransactionHistory` read convention.
 */
export function useAddressAliases({
  owner,
  suiClient,
  chain,
  enabled = true,
}: {
  owner: string | null | undefined
  suiClient: SuiGrpcClient
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
