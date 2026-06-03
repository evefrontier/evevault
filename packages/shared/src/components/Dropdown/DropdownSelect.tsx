import type React from 'react'
import { useRef } from 'react'
import './DropdownSelect.css'
import type { DropdownItem, DropdownSelectProps } from '#/types'
import {
  useDropdownOpenState,
  useMeasuredMenuHeight,
  useOutsideClick,
  useShowIconOnly,
} from './DropdownSelect.helpers'
import {
  DropdownSelectMenu,
  DropdownSelectTrigger,
} from './DropdownSelect.parts'

export const DropdownSelect: React.FC<DropdownSelectProps> = ({
  items,
  trigger,
  className = '',
  identicon = 0,
  children,
  isOpen: controlledIsOpen,
  onOpenChange,
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { isOpen, setIsOpen } = useDropdownOpenState({
    controlledIsOpen,
    onOpenChange,
  })
  const { menuHeight, menuRef } = useMeasuredMenuHeight(isOpen)
  const showIconOnly = useShowIconOnly()
  useOutsideClick(dropdownRef, () => setIsOpen(false))

  const handleItemClick = (item: DropdownItem) => {
    item.onClick()
    if (!item.preventCloseOnClick) {
      setIsOpen(false)
    }
  }

  return (
    <div
      className={`dropdown-select ${isOpen ? 'dropdown-select--open' : ''} ${className}`}
      ref={dropdownRef}
      style={{ '--menu-height': `${menuHeight}px` } as React.CSSProperties}
    >
      <DropdownSelectTrigger
        identicon={identicon}
        isOpen={isOpen}
        menuHeight={menuHeight}
        onToggle={() => setIsOpen(!isOpen)}
        showIconOnly={showIconOnly}
        trigger={trigger}
      />

      {isOpen ? (
        <DropdownSelectMenu
          items={items}
          menuRef={menuRef}
          onItemClick={handleItemClick}
        >
          {children}
        </DropdownSelectMenu>
      ) : null}
    </div>
  )
}

export default DropdownSelect
