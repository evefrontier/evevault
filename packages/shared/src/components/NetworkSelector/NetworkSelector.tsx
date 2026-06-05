import type React from 'react'
import { useMemo, useRef, useState } from 'react'
import { useContext } from '#/hooks'
import type { NetworkSelectorProps } from '#/types'
import './NetworkSelector.css'
import {
  useAvailableNetworks,
  useNetworkSelection,
  useValidNetwork,
} from './NetworkSelector.helpers'
import { NetworkMenu, NetworkTrigger } from './NetworkSelector.parts'

export const NetworkSelector: React.FC<NetworkSelectorProps> = ({
  chain,
  className = '',
  compact = false,
  onNetworkSwitchStart,
  onRequiresReauth,
  onLocalnetSelected,
}) => {
  const { setChain, forceSetChain, loading, devMode } = useContext()

  const [isOpen, setIsOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const { availableNetworks, isExtensionContext } =
    useAvailableNetworks(devMode)
  useValidNetwork({ availableNetworks, chain, forceSetChain })

  const handleNetworkSelect = useNetworkSelection({
    chain,
    isExtensionContext,
    onLocalnetSelected,
    onNetworkSwitchStart,
    onRequiresReauth,
    setChain,
    setIsOpen,
    setIsProcessing,
  })

  const currentNetwork = useMemo(
    () =>
      availableNetworks.find((n) => n.chain === chain) ?? availableNetworks[0],
    [availableNetworks, chain],
  )

  const isDisabled = loading || isProcessing
  const handleToggle = () => {
    if (!isDisabled) setIsOpen(!isOpen)
  }

  return (
    <div
      className={`dropdown-selector ${
        isExtensionContext ? 'dropdown-selector--extension' : ''
      } ${className}`}
    >
      <NetworkTrigger
        chain={chain}
        compact={compact}
        currentNetwork={currentNetwork}
        disabled={isDisabled}
        isOpen={isOpen}
        onToggle={handleToggle}
        triggerRef={triggerRef}
      />

      {isOpen ? (
        <NetworkMenu
          availableNetworks={availableNetworks}
          chain={chain}
          disabled={isDisabled}
          isExtensionContext={isExtensionContext}
          onClose={() => setIsOpen(false)}
          onNetworkSelect={handleNetworkSelect}
          triggerRef={triggerRef}
        />
      ) : null}
    </div>
  )
}

export default NetworkSelector
