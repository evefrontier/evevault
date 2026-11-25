import type { SuiChain } from '@mysten/wallet-standard'
import type React from 'react'
import { Dropdown } from '#/components/Dropdown'
import Icon from '#/components/Icon'
import { Lamp } from '#/components/StatusChip'
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
        <Lamp tone="on" />
        <span className="dropdown-selector__value">
          {currentNetwork.shortLabel}
        </span>
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
      <Lamp tone="on" />
      <span className="sr-only">NETWORK</span>{' '}
      <span className="dropdown-selector__value">{chain.toUpperCase()}</span>
      <Icon
        name="ChevronArrowDown"
        width={10}
        height={10}
        color="currentColor"
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

/** Network options in a dropdown that opens above or below the trigger. */
export function NetworkMenu({
  availableNetworks,
  chain,
  disabled,
  placement,
  onClose,
  onNetworkSelect,
  triggerRef,
}: {
  availableNetworks: NetworkOption[]
  chain: string
  disabled: boolean
  placement: 'top' | 'bottom'
  onClose: () => void
  onNetworkSelect: (chain: SuiChain) => void
  triggerRef: React.RefObject<HTMLButtonElement | null>
}) {
  return (
    <Dropdown
      onClickOutside={onClose}
      triggerRef={triggerRef}
      placement={placement}
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
