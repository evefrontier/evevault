import { useCallback } from 'react'
import { useContextStore } from '#/stores/contextStore'
import { getExplorerName, getExplorerUrl } from '#/utils/explorer'

/** The user's block explorer choice, with helpers that apply it to a chain. */
export const useExplorer = () => {
  const explorer = useContextStore((state) => state.explorer)
  const setExplorer = useContextStore((state) => state.setExplorer)

  const urlFor = useCallback(
    (chain: string, txDigest: string, opts?: { localnetUrl?: string }) =>
      getExplorerUrl(chain, txDigest, explorer, opts),
    [explorer],
  )
  const nameFor = useCallback(
    (chain: string) => getExplorerName(chain, explorer),
    [explorer],
  )

  return { explorer, setExplorer, urlFor, nameFor }
}
