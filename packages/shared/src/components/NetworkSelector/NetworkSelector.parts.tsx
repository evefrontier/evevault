import type { SuiChain } from '@mysten/wallet-standard'
import type React from 'react'
import { Dropdown } from '#/components/Dropdown'
import Icon from '#/components/Icon'
import Text from '#/components/Text'
import type { NetworkOption } from '#/types'

/**
 * Keeps the open-state class generation shared between full and compact
 * triggers without duplicating the selector CSS names.
 */
function getChevronClassName(isOpen: boolean) {
  return `dropdown-selector__chevron ${
    isOpen ? 'dropdown-selector__chevron--open' : ''
  }`
}

/**
 * Renders either the compact extension badge or full selector trigger while
 * preserving one ref target for dropdown positioning.
 */
export function NetworkTrigger({
  chain,
  compact,
  currentNetwork,
  disabled,
  isOpen,
  onToggle,
  triggerRef,
}: {
  chain: string
  compact: boolean
  currentNetwork: NetworkOption
  disabled: boolean
  isOpen: boolean
  onToggle: () => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
}) {
  if (compact) {
    return (
      <button
        ref={triggerRef}
        type="button"
        className="network-selector__badge"
        onClick={onToggle}
        disabled={disabled}
      >
        <Text size="small" variant="bold" color="neutral">
          {currentNetwork.shortLabel}
        </Text>
      </button>
    )
  }

  return (
    <button
      ref={triggerRef}
      type="button"
      className="dropdown-selector__trigger"
      onClick={onToggle}
      disabled={disabled}
    >
      <Icon name="Network" color="quantum" />
      <div className="flex flex-col gap-0.5">
        <Text
          className="text-start"
          variant="label-small"
          color="neutral-50"
          size="small"
        >
          NETWORK
        </Text>
        <Text variant="label-medium" size="medium">
          {chain.toUpperCase()}
        </Text>
      </div>
      <Icon
        name="ChevronArrowDown"
        width={16}
        height={16}
        color="neutral"
        className={getChevronClassName(isOpen)}
      />
    </button>
  )
}

/**
 * Keeps active-state styling and chain selection together so every network
 * option gets the same disabled and selected behavior.
 */
function NetworkMenuItem({
  chain,
  disabled,
  network,
  onNetworkSelect,
}: {
  chain: string
  disabled: boolean
  network: NetworkOption
  onNetworkSelect: (chain: SuiChain) => void
}) {
  const isActive = network.chain === chain

  return (
    <button
      className={`dropdown__item ${isActive ? 'dropdown__item--active' : ''}`}
      onClick={() => onNetworkSelect(network.chain)}
      disabled={disabled}
      type="button"
    >
      <Text
        size="medium"
        variant={isActive ? 'bold' : 'regular'}
        color={isActive ? 'quantum' : 'neutral'}
      >
        {network.label}
      </Text>
      {isActive ? <span className="dropdown__check">✓</span> : null}
    </button>
  )
}

/**
 * Chooses dropdown placement from runtime context because extension popups open
 * the network menu upward from the footer area.
 */
export function NetworkMenu({
  availableNetworks,
  chain,
  disabled,
  isExtensionContext,
  onClose,
  onNetworkSelect,
  triggerRef,
}: {
  availableNetworks: NetworkOption[]
  chain: string
  disabled: boolean
  isExtensionContext: boolean
  onClose: () => void
  onNetworkSelect: (chain: SuiChain) => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
}) {
  return (
    <Dropdown
      onClickOutside={onClose}
      triggerRef={triggerRef}
      placement={isExtensionContext ? 'top' : 'bottom'}
    >
      {availableNetworks.map((network) => (
        <NetworkMenuItem
          key={network.chain}
          chain={chain}
          disabled={disabled}
          network={network}
          onNetworkSelect={onNetworkSelect}
        />
      ))}
    </Dropdown>
  )
}
