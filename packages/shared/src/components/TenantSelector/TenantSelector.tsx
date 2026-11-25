import type React from 'react'
import { useCallback, useRef, useState } from 'react'
import { Dropdown } from '#/components/Dropdown'
import Icon from '#/components/Icon'
import Text from '#/components/Text'
import { getTenantLabel } from '#/utils/tenantConfig'
import './TenantSelector.css'
import type { TenantId } from '@evefrontier/wallet-core/tenant'
import type {
  TenantSelectorInteractiveProps,
  TenantSelectorProps,
  TenantSelectorPropsBase,
} from '#/types'

const TenantSelectorViewOnly = ({
  currentTenantId,
  className = '',
}: TenantSelectorPropsBase & { viewOnly: true }) => {
  return (
    <div
      className={`dropdown-selector dropdown-selector--inline dropdown-selector--brand ${className}`.trim()}
      role="presentation"
    >
      <div className="dropdown-selector__trigger">
        <span className="dropdown-selector__value">
          {getTenantLabel(currentTenantId)}
        </span>
      </div>
    </div>
  )
}

const TenantSelectorInteractive = ({
  currentTenantId,
  availableTenantIds,
  onServerChange,
  className = '',
}: TenantSelectorInteractiveProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const handleSelect = useCallback(
    (id: TenantId) => {
      onServerChange(id)
      setIsOpen(false)
    },
    [onServerChange],
  )

  const currentLabel = getTenantLabel(currentTenantId)

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: div is for event capture only, not interactive content
    <div
      className={`dropdown-selector dropdown-selector--brand ${className}`.trim()}
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
      onKeyDown={(e: React.KeyboardEvent) => e.stopPropagation()}
      role="presentation"
    >
      <button
        ref={triggerRef}
        type="button"
        className="dropdown-selector__trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Tenant"
      >
        <span className="dropdown-selector__value">{currentLabel}</span>
        <Icon
          name="ChevronArrowDown"
          width={10}
          height={10}
          color="currentColor"
          className={`dropdown-selector__chevron ${isOpen ? 'dropdown-selector__chevron--open' : ''}`}
        />
      </button>

      {isOpen && (
        <Dropdown
          onClickOutside={() => setIsOpen(false)}
          triggerRef={triggerRef}
          placement="bottom"
        >
          {availableTenantIds.map((id: TenantId) => {
            const isActive = id === currentTenantId
            return (
              <button
                key={id}
                type="button"
                className={`dropdown__item ${isActive ? 'dropdown__item--active' : ''}`}
                onClick={() => handleSelect(id)}
              >
                <Text
                  size="medium"
                  variant={isActive ? 'bold' : 'regular'}
                  color={isActive ? 'quantum' : 'neutral'}
                >
                  {getTenantLabel(id)}
                </Text>
                {isActive && <span className="dropdown__check">✓</span>}
              </button>
            )
          })}
        </Dropdown>
      )}
    </div>
  )
}

export const TenantSelector: React.FC<TenantSelectorProps> = (props) => {
  if (props.viewOnly === true) {
    return <TenantSelectorViewOnly {...props} />
  }
  return <TenantSelectorInteractive {...props} />
}

export default TenantSelector
