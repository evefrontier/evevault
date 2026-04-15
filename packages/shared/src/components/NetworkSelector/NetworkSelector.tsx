import type { SuiChain } from "@mysten/wallet-standard";
import type React from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useNetworkStore } from "../../stores";
import type { NetworkSelectorProps } from "../../types";
import { AVAILABLE_NETWORKS } from "../../types";
import { createLogger, isExtension } from "../../utils";
import Icon from "../Icon";
import Text from "../Text";
import "./NetworkSelector.css";
import { Dropdown } from "../Dropdown";

const log = createLogger();

export const NetworkSelector: React.FC<NetworkSelectorProps> = ({
  chain,
  className = "",
  compact = false,
  onNetworkSwitchStart,
  onRequiresReauth,
}) => {
  const { setChain, loading } = useNetworkStore();

  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleNetworkSelect = useCallback(
    async (targetChain: SuiChain) => {
      if (targetChain === chain) {
        setIsOpen(false);
        return;
      }

      setIsOpen(false);
      setIsProcessing(true);

      const result = await setChain(targetChain);

      if (!result.success) {
        log.error("Failed to switch network");
      } else if (result.requiresReauth) {
        onNetworkSwitchStart?.(chain, targetChain);
        onRequiresReauth?.(targetChain);
      }

      setIsProcessing(false);
    },
    [chain, setChain, onNetworkSwitchStart, onRequiresReauth],
  );

  const currentNetwork = useMemo(
    () =>
      AVAILABLE_NETWORKS.find((n) => n.chain === chain) ??
      AVAILABLE_NETWORKS[0],
    [chain],
  );

  const isDisabled = loading || isProcessing;
  const isExtensionContext = isExtension();

  return (
    <div
      className={`dropdown-selector ${
        isExtensionContext ? "dropdown-selector--extension" : ""
      } ${className}`}
    >
      {compact ? (
        <button
          ref={triggerRef}
          type="button"
          className="network-selector__badge"
          onClick={() => !isDisabled && setIsOpen(!isOpen)}
          disabled={isDisabled}
        >
          <Text size="small" variant="bold" color="neutral">
            {currentNetwork.shortLabel}
          </Text>
        </button>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          className="dropdown-selector__trigger"
          onClick={() => !isDisabled && setIsOpen(!isOpen)}
          disabled={isDisabled}
        >
          <Icon name="Network" color="quantum" />
          <div className="flex flex-col gap-0.5">
            <Text
              className="text-start"
              variant="label-small"
              color="neutral-50"
              size="small"
            >
              NETWORK
            </Text>
            <Text variant="label-medium" size="medium">
              {chain.toUpperCase()}
            </Text>
          </div>
          <Icon
            name="ChevronArrowDown"
            width={16}
            height={16}
            color="neutral"
            className={`dropdown-selector__chevron ${
              isOpen ? "dropdown-selector__chevron--open" : ""
            }`}
          />
        </button>
      )}

      {isOpen && (
        <Dropdown
          onClickOutside={() => setIsOpen(false)}
          triggerRef={triggerRef}
          placement={isExtensionContext ? "top" : "bottom"}
        >
          {AVAILABLE_NETWORKS.map((network) => (
            <button
              key={network.chain}
              className={`dropdown__item ${
                network.chain === chain ? "dropdown__item--active" : ""
              }`}
              onClick={() => handleNetworkSelect(network.chain)}
              disabled={isDisabled}
              type="button"
            >
              <Text
                size="medium"
                variant={network.chain === chain ? "bold" : "regular"}
                color={network.chain === chain ? "quantum" : "neutral"}
              >
                {network.label}
              </Text>
              {network.chain === chain && (
                <span className="dropdown__check">✓</span>
              )}
            </button>
          ))}
        </Dropdown>
      )}
    </div>
  );
};

export default NetworkSelector;
