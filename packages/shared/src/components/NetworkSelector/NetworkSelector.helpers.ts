import { SUI_LOCALNET_CHAIN, type SuiChain } from '@mysten/wallet-standard'
import { useCallback, useEffect, useMemo } from 'react'
import type { NetworkSelectorProps } from '#/types'
import { getAvailableNetworks } from '#/types'
import { createLogger, isExtension } from '#/utils'

const log = createLogger()

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

function notifyRequiresReauth(
  targetChain: SuiChain,
  params: UseNetworkSelectionParams,
) {
  params.onNetworkSwitchStart?.(params.chain, targetChain)
  params.onRequiresReauth?.(targetChain)
}

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

export function useAvailableNetworks(devMode: boolean) {
  const isExtensionContext = isExtension()
  const availableNetworks = useMemo(
    () => getAvailableNetworks(devMode, isExtensionContext),
    [devMode, isExtensionContext],
  )

  return { availableNetworks, isExtensionContext }
}

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

export function useNetworkSelection(params: UseNetworkSelectionParams) {
  const {
    chain,
    isExtensionContext,
    onLocalnetSelected,
    onNetworkSwitchStart,
    onRequiresReauth,
    setChain,
    setIsOpen,
    setIsProcessing,
  } = params

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
          await handleSuccessfulNetworkSwitch(result, targetChain, {
            chain,
            isExtensionContext,
            onLocalnetSelected,
            onNetworkSwitchStart,
            onRequiresReauth,
            setChain,
            setIsOpen,
            setIsProcessing,
          })
        }
      } catch (error) {
        log.error('Failed to switch network', error)
      } finally {
        setIsProcessing(false)
      }
    },
    [
      chain,
      isExtensionContext,
      onLocalnetSelected,
      onNetworkSwitchStart,
      onRequiresReauth,
      setChain,
      setIsOpen,
      setIsProcessing,
    ],
  )
}
