import type React from 'react'
import { Corners } from '#/components/Corners'
import Icon from '#/components/Icon'
import type { DropdownItem } from '#/types'

/**
 * Keeps the trigger decoration colocated with the measured menu height so the
 * corner animation remains aligned with custom menu content.
 */
export function DropdownSelectTrigger({
  isOpen,
  menuHeight,
  onToggle,
  showIconOnly,
  trigger,
}: {
  isOpen: boolean
  menuHeight: number
  onToggle: () => void
  showIconOnly: boolean
  trigger: React.ReactNode
}) {
  return (
    <button
      type="button"
      className={`dropdown-select__trigger ${showIconOnly ? 'dropdown-select__trigger--icon-only' : ''}`}
      onClick={onToggle}
      aria-expanded={isOpen}
      aria-haspopup="true"
    >
      <div className="dropdown-select__inner">
        <div className="dropdown-select__content">
          {!showIconOnly ? (
            <span className="dropdown-select__text">{trigger}</span>
          ) : null}
        </div>
        <span
          className={`dropdown-select__arrow ${isOpen ? 'dropdown-select__arrow--open' : ''}`}
        >
          <Icon
            name="ChevronArrowDown"
            width={10}
            height={10}
            color="currentColor"
          />
        </span>
      </div>

      <Corners
        color="quantum"
        size={5}
        thickness={1}
        bottomOffset={isOpen && !showIconOnly ? menuHeight + 3 : 0}
        transition={showIconOnly ? undefined : 'bottom 0.3s ease'}
      />

      <span className="dropdown-select__edge dropdown-select__edge--left" />
      <span className="dropdown-select__edge dropdown-select__edge--right" />
    </button>
  )
}

/**
 * Handles keyboard activation locally because dropdown items are rendered as
 * divs to support arbitrary custom content.
 */
function DropdownSelectItem({
  item,
  onItemClick,
}: {
  item: DropdownItem
  onItemClick: (item: DropdownItem) => void
}) {
  return (
    <div
      className="dropdown-select__item"
      onClick={() => onItemClick(item)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onItemClick(item)
      }}
      role="menuitem"
      tabIndex={0}
    >
      {item.customContent ?? (
        <span
          className={`dropdown-select__item-text ${item.devMode ? 'dropdown-select__item-text--dev' : ''}`.trim()}
        >
          {item.label}
        </span>
      )}
    </div>
  )
}

/**
 * Falls back to generated item rows only when no custom children are provided,
 * preserving the legacy items API while allowing richer menu bodies.
 */
export function DropdownSelectMenu({
  children,
  items,
  menuRef,
  onItemClick,
}: {
  children?: React.ReactNode
  items?: DropdownItem[]
  menuRef: React.RefObject<HTMLDivElement | null>
  onItemClick: (item: DropdownItem) => void
}) {
  return (
    <div className="dropdown-select__menu" ref={menuRef}>
      {children ||
        items?.map((item) => (
          <DropdownSelectItem
            key={item.label}
            item={item}
            onItemClick={onItemClick}
          />
        ))}
    </div>
  )
}
