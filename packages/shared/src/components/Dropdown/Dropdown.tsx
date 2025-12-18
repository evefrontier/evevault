import type React from "react";
import { useEffect, useRef, useState } from "react";
import "./Dropdown.css";
import type { DropdownItem, DropdownProps } from "@evevault/shared/types";
import { Corners } from "../Corners";
import Icon from "../Icon";
import Text from "../Text";
import { getIdenticon } from "./Identicons";

export const Dropdown: React.FC<DropdownProps> = ({
  items,
  trigger,
  className = "",
  identicon = 0,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuHeight, setMenuHeight] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
  }, []);

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
      className={`dropdown ${isOpen ? "dropdown--open" : ""} ${className}`}
      ref={dropdownRef}
      style={{ "--menu-height": `${menuHeight}px` } as React.CSSProperties}
    >
      <button
        type="button"
        className="dropdown__trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {/* Inner content */}
        <div className="dropdown__inner">
          <div className="dropdown__content">
            {getIdenticon(identicon)}
            <span className="dropdown__text">{trigger}</span>
          </div>
          <span
            className={`dropdown__arrow ${isOpen ? "dropdown__arrow--open" : ""}`}
          >
            <Icon name="ChevronArrowDown" size="small" color="#FF4700" />
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
        <span className="dropdown__edge dropdown__edge--left" />
        <span className="dropdown__edge dropdown__edge--right" />
      </button>

      {isOpen && (
        <div className="dropdown__menu" ref={menuRef}>
          {items.map((item, index) => (
            <div
              key={item.label}
              className="dropdown__item"
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

export default Dropdown;
