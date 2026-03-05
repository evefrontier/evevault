import type React from "react";
import { useEffect, useRef } from "react";
import type { DropdownProps } from "../../types";
import { Corners } from "../Corners";
import "./Dropdown.css";

/**
 * Simple dropdown menu container with corners/edges styling.
 * Use this when you have your own trigger and just need the menu container.
 */
export const Dropdown: React.FC<DropdownProps> = ({
  children,
  className = "",
  onClickOutside,
  triggerRef,
  placement = "bottom",
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside (but not on trigger)
  useEffect(() => {
    if (!onClickOutside) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsideMenu = menuRef.current?.contains(target);
      const isOnTrigger = triggerRef?.current?.contains(target);

      if (!isInsideMenu && !isOnTrigger) {
        onClickOutside();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClickOutside, triggerRef]);

  const placementClass = placement === "top" ? "dropdown--placement-top" : "";
  const dropdownClassName = ["dropdown", placementClass, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={dropdownClassName} ref={menuRef}>
      <Corners color="quantum" size={5} thickness={1} />
      <span className="dropdown__edge dropdown__edge--left" />
      <span className="dropdown__edge dropdown__edge--right" />
      <div className="dropdown__content">{children}</div>
    </div>
  );
};

export default Dropdown;
