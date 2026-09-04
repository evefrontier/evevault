import type { IntentScope } from '@mysten/sui/cryptography'
import type { SuiChain } from '@mysten/wallet-standard'
import { useCallback } from 'react'
import { getUserForNetwork } from '#/auth'
import type { ZkSignAnyParams } from '#/types/wallet'
import { signForChain } from '#/wallet/signForChain'

type SigningCallbacksParams = {
  chain: SuiChain
  isLocalnet: boolean
  localnetAddress: string | null
  getZkProof: ZkSignAnyParams['getZkProof']
}

/** All callbacks are memoized with `useCallback` so dependent hooks and components don't re-render on every render cycle. */
export const useWalletSigningCallbacks = ({
  chain,
  isLocalnet,
  localnetAddress,
  getZkProof,
}: SigningCallbacksParams) => {
  const getSenderAddress = useCallback(async () => {
    return isLocalnet ? localnetAddress : getNetworkUserAddress(chain)
  }, [isLocalnet, localnetAddress, chain])

  const getZkLoginUser = useCallback(async () => {
    return isLocalnet ? null : getUserForNetwork(chain)
  }, [chain, isLocalnet])

  const sign = useCallback(
    async (
      scope: IntentScope,
      msgBytes: Uint8Array,
      signOpts?: { allowAddressAliasCalls?: boolean },
    ) => {
      const zkLoginUser = await getZkLoginUser()
      return signForChain(scope, msgBytes, {
        chain,
        user: zkLoginUser,
        getZkProof: isLocalnet ? null : getZkProof,
        localnetAddress,
        allowAddressAliasCalls: signOpts?.allowAddressAliasCalls,
      })
    },
    [chain, isLocalnet, getZkProof, localnetAddress, getZkLoginUser],
  )

  return { getSenderAddress, sign }
}

/** `profile.sui_address` is typed as `unknown` in the user profile schema, so an explicit cast is required here. */
const getNetworkUserAddress = async (
  chain: SuiChain,
): Promise<string | null> => {
  const networkUser = await getUserForNetwork(chain)
  return (networkUser?.profile?.sui_address as string | undefined) ?? null
}
