import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TenantId } from "../../auth/tenantConfig";
import { getTenantLabel } from "../../auth/tenantConfig";
import { Dropdown } from "../Dropdown";
import Icon from "../Icon";
import Text from "../Text";
import "./TenantSelector.css";

export interface TenantSelectorProps {
  currentTenantId: TenantId;
  availableTenantIds: TenantId[];
  onServerChange: (tenantId: TenantId) => void;
  /** Inline: compact trigger (label + chevron). Standalone: label "SERVER" + value + chevron like NetworkSelector. */
  variant?: "inline" | "standalone";
  className?: string;
}

export const TenantSelector: React.FC<TenantSelectorProps> = ({
  currentTenantId,
  availableTenantIds,
  onServerChange,
  variant = "standalone",
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleSelect = useCallback(
    (id: TenantId) => {
      onServerChange(id);
      setIsOpen(false);
    },
    [onServerChange],
  );

  const currentLabel = getTenantLabel(currentTenantId);
  const isInline = variant === "inline";

  return (
    // Wrapper only stops propagation so dropdown doesn't close when clicking inside; no semantic role needed
    // biome-ignore lint/a11y/noStaticElementInteractions: div is for event capture only, not interactive content
    <div
      className={`server-selector server-selector--${variant} ${className}`.trim()}
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
      onKeyDown={(e: React.KeyboardEvent) => e.stopPropagation()}
      role="presentation"
    >
      <button
        ref={triggerRef}
        type="button"
        className="server-selector__trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Server"
      >
        {isInline ? (
          <>
            <Text size="medium" variant="regular" color="neutral">
              {currentLabel}
            </Text>
            <Icon
              name="ChevronArrowDown"
              width={16}
              height={16}
              color="neutral"
              className={`server-selector__chevron ${isOpen ? "server-selector__chevron--open" : ""}`}
            />
          </>
        ) : (
          <>
            <Icon name="Network" color="quantum" />
            <div className="flex flex-col gap-0.5">
              <Text variant="label-medium" size="medium">
                {currentLabel}
              </Text>
            </div>
            <Icon
              name="ChevronArrowDown"
              width={16}
              height={16}
              color="neutral"
              className={`server-selector__chevron ${isOpen ? "server-selector__chevron--open" : ""}`}
            />
          </>
        )}
      </button>

      {isOpen && (
        <Dropdown
          onClickOutside={() => setIsOpen(false)}
          triggerRef={triggerRef}
          placement="bottom"
        >
          {availableTenantIds.map((id) => {
            const isActive = id === currentTenantId;
            return (
              <button
                key={id}
                type="button"
                className={`dropdown__item ${isActive ? "dropdown__item--active" : ""}`}
                onClick={() => handleSelect(id)}
              >
                <Text
                  size="medium"
                  variant={isActive ? "bold" : "regular"}
                  color={isActive ? "quantum" : "neutral"}
                >
                  {getTenantLabel(id)}
                </Text>
                {isActive && <span className="dropdown__check">✓</span>}
              </button>
            );
          })}
        </Dropdown>
      )}
    </div>
  );
};

export default TenantSelector;
