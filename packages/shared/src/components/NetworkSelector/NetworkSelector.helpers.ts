import { SUI_LOCALNET_CHAIN, type SuiChain } from '@mysten/wallet-standard'
import { useCallback, useEffect, useMemo } from 'react'
import type { NetworkSelectorProps } from '#/types'
import { getAvailableNetworks } from '#/types'
import { createLogger, isExtension } from '#/utils'

type NetworkSwitchResult = {
  requiresReauth?: boolean
  success: boolean
}

type UseNetworkSelectionParams = Pick<
  NetworkSelectorProps,
  'chain' | 'onLocalnetSelected' | 'onNetworkSwitchStart' | 'onRequiresReauth'
> & {
  isExtensionContext: boolean
  setChain: (chain: SuiChain) => Promise<NetworkSwitchResult>
  setIsOpen: (isOpen: boolean) => void
  setIsProcessing: (isProcessing: boolean) => void
}

const log = createLogger()

/**
 * Notifies both network-switch callbacks together because re-auth means the
 * wallet selected the target chain but the session is not usable yet.
 */
function notifyRequiresReauth(
  targetChain: SuiChain,
  params: UseNetworkSelectionParams,
) {
  params.onNetworkSwitchStart?.(params.chain, targetChain)
  params.onRequiresReauth?.(targetChain)
}

/**
 * Runs only the post-switch side effects that depend on a successful store
 * update, keeping failed switches from opening localnet setup.
 */
async function handleSuccessfulNetworkSwitch(
  result: NetworkSwitchResult,
  targetChain: SuiChain,
  params: UseNetworkSelectionParams,
) {
  if (result.requiresReauth) {
    notifyRequiresReauth(targetChain, params)
    return
  }

  if (targetChain === SUI_LOCALNET_CHAIN && params.isExtensionContext) {
    await params.onLocalnetSelected?.()
  }
}

/**
 * Computes the menu choices from dev mode and runtime context because localnet
 * is extension-only even when development mode is enabled.
 */
export function useAvailableNetworks(devMode: boolean) {
  const isExtensionContext = isExtension()
  const availableNetworks = useMemo(
    () => getAvailableNetworks(devMode, isExtensionContext),
    [devMode, isExtensionContext],
  )

  return { availableNetworks, isExtensionContext }
}

/**
 * Forces an available chain when persisted state points to a network hidden by
 * the current runtime or dev-mode configuration.
 */
export function useValidNetwork({
  availableNetworks,
  chain,
  forceSetChain,
}: {
  availableNetworks: ReturnType<typeof getAvailableNetworks>
  chain: string
  forceSetChain: (chain: SuiChain) => void
}) {
  useEffect(() => {
    if (availableNetworks.some((network) => network.chain === chain)) return
    forceSetChain(availableNetworks[0].chain)
  }, [availableNetworks, chain, forceSetChain])
}

/**
 * Keeps async network switching serialized through one callback so menu state,
 * processing state, and re-auth callbacks cannot diverge.
 */
export function useNetworkSelection(params: UseNetworkSelectionParams) {
  const { chain, setChain, setIsOpen, setIsProcessing } = params

  return useCallback(
    async (targetChain: SuiChain) => {
      if (targetChain === chain) {
        setIsOpen(false)
        return
      }

      setIsOpen(false)
      setIsProcessing(true)

      try {
        const result = await setChain(targetChain)

        if (!result.success) {
          log.error('Failed to switch network')
        } else {
          await handleSuccessfulNetworkSwitch(result, targetChain, params)
        }
      } catch (error) {
        log.error('Failed to switch network', error)
      } finally {
        setIsProcessing(false)
      }
    },
    [chain, setChain, setIsOpen, setIsProcessing, params],
  )
}
