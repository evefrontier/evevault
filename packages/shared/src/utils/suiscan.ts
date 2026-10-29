import { isLocalnetChain } from '#/types/networks'
import { LOCAL_DEV, LOCAL_DEV_SUI_URL } from '#/utils/localDev'

/**
 * Generates a Suiscan URL for a transaction.
 * For localnet, returns a custom Suiscan account URL when address and localnetUrl are provided.
 */
export function getSuiscanUrl(
  chain: string,
  txDigest: string,
  opts?: { localnetUrl?: string },
): string {
  if (isLocalnetChain(chain) && opts?.localnetUrl) {
    return `https://custom.suiscan.xyz/custom/tx/${txDigest}?network=${encodeURIComponent(opts.localnetUrl)}`
  }
  // LOCAL_DEV: the stack's localnet, through Suiscan's custom network too.
  if (LOCAL_DEV && chain === 'sui:localnet') {
    return `https://custom.suiscan.xyz/custom/tx/${txDigest}?network=${encodeURIComponent(opts?.localnetUrl || LOCAL_DEV_SUI_URL)}`
  }
  const network = chain.replace('sui:', '')
  return `https://suiscan.xyz/${network}/tx/${txDigest}`
}
