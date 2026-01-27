import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import "./DropdownSelect.css";
import type { DropdownItem, DropdownSelectProps } from "../../types";
import { Corners } from "../Corners";
import Icon from "../Icon";
import Text from "../Text";
import { getIdenticon } from "./Identicons";

export const DropdownSelect: React.FC<DropdownSelectProps> = ({
  items,
  trigger,
  className = "",
  identicon = 0,
  children,
  isOpen: controlledIsOpen,
  onOpenChange,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [menuHeight, setMenuHeight] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Support both controlled and uncontrolled modes
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;

  const setIsOpen = useCallback(
    (open: boolean) => {
      if (controlledIsOpen !== undefined) {
        onOpenChange?.(open);
      } else {
        setInternalIsOpen(open);
      }
    },
    [controlledIsOpen, onOpenChange],
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [setIsOpen]);

  // Measure menu height when open
  useEffect(() => {
    if (isOpen && menuRef.current) {
      setMenuHeight(menuRef.current.offsetHeight);
    }
  }, [isOpen]);

  const handleItemClick = (item: DropdownItem) => {
    item.onClick();
    setIsOpen(false);
  };

  return (
    <div
      className={`dropdown-select ${isOpen ? "dropdown-select--open" : ""} ${className}`}
      ref={dropdownRef}
      style={{ "--menu-height": `${menuHeight}px` } as React.CSSProperties}
    >
      <button
        type="button"
        className="dropdown-select__trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {/* Inner content */}
        <div className="dropdown-select__inner">
          <div className="dropdown-select__content">
            {getIdenticon(identicon)}
            <span className="dropdown-select__text">{trigger}</span>
          </div>
          <span
            className={`dropdown-select__arrow ${isOpen ? "dropdown-select__arrow--open" : ""}`}
          >
            <Icon name="ChevronArrowDown" size="small" color="quantum" />
          </span>
        </div>

        <Corners
          color="quantum"
          size={5}
          thickness={1}
          bottomOffset={isOpen ? menuHeight + 3 : 0}
          transition="bottom 0.3s ease"
        />

        {/* Edge lines */}
        <span className="dropdown-select__edge dropdown-select__edge--left" />
        <span className="dropdown-select__edge dropdown-select__edge--right" />
      </button>

      {isOpen && (
        <div className="dropdown-select__menu" ref={menuRef}>
          {children ||
            items?.map((item, index) => (
              <div
                key={item.label}
                className="dropdown-select__item"
                onClick={() => handleItemClick(item)}
                onKeyDown={(e) => e.key === "Enter" && handleItemClick(item)}
                role="menuitem"
                tabIndex={0}
              >
                {getIdenticon(index)}
                <Text variant="label">{item.label}</Text>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

export default DropdownSelect;
