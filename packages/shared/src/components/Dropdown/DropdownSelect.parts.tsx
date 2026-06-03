import type React from 'react'
import { Corners } from '#/components/Corners'
import Icon from '#/components/Icon'
import Text from '#/components/Text'
import type { DropdownItem } from '#/types'
import { getIdenticon } from './Identicons'

export function DropdownSelectTrigger({
  identicon,
  isOpen,
  menuHeight,
  onToggle,
  showIconOnly,
  trigger,
}: {
  identicon: number
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
          {getIdenticon(identicon)}
          {!showIconOnly ? (
            <span className="dropdown-select__text">{trigger}</span>
          ) : null}
        </div>
        <span
          className={`dropdown-select__arrow ${isOpen ? 'dropdown-select__arrow--open' : ''}`}
        >
          <Icon name="ChevronArrowDown" size="small" color="quantum" />
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

function DropdownSelectItem({
  item,
  itemIdenticon,
  onItemClick,
}: {
  item: DropdownItem
  itemIdenticon: number
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
        <>
          {getIdenticon(itemIdenticon)}
          <Text variant="label">{item.label}</Text>
        </>
      )}
    </div>
  )
}

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
        items?.map((item, index) => (
          <DropdownSelectItem
            key={item.label}
            item={item}
            itemIdenticon={index}
            onItemClick={onItemClick}
          />
        ))}
    </div>
  )
}
