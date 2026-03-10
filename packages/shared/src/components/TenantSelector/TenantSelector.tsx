import type React from "react";
import { useCallback, useRef, useState } from "react";
import { getTenantLabel } from "../../utils/tenantConfig";
import { Dropdown } from "../Dropdown";
import Icon from "../Icon";
import Text from "../Text";
import "./TenantSelector.css";
import type {
  TenantId,
  TenantSelectorInteractiveProps,
  TenantSelectorProps,
  TenantSelectorPropsBase,
} from "@evevault/shared/types";

const TenantSelectorViewOnly = ({
  currentTenantId,
  className = "",
}: TenantSelectorPropsBase & { viewOnly: true }) => {
  return (
    <div
      className={`dropdown-selector dropdown-selector--inline ${className}`.trim()}
      role="presentation"
    >
      <div className="dropdown-selector__trigger">
        <Text size="medium" variant="regular" color="neutral">
          {getTenantLabel(currentTenantId)}
        </Text>
      </div>
    </div>
  );
};

const TenantSelectorInteractive = ({
  currentTenantId,
  availableTenantIds,
  onServerChange,
  className = "",
}: TenantSelectorInteractiveProps) => {
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

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: div is for event capture only, not interactive content
    <div
      className={`dropdown-selector ${className}`.trim()}
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
          className={`dropdown-selector__chevron ${isOpen ? "dropdown-selector__chevron--open" : ""}`}
        />
      </button>

      {isOpen && (
        <Dropdown
          onClickOutside={() => setIsOpen(false)}
          triggerRef={triggerRef}
          placement="bottom"
        >
          {availableTenantIds.map((id: TenantId) => {
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

export const TenantSelector: React.FC<TenantSelectorProps> = (props) => {
  if (props.viewOnly === true) {
    return <TenantSelectorViewOnly {...props} />;
  }
  return <TenantSelectorInteractive {...props} />;
};

export default TenantSelector;
