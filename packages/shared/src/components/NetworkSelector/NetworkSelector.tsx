import { SUI_LOCALNET_CHAIN, type SuiChain } from "@mysten/wallet-standard";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNetworkStore } from "../../stores";
import { useTenantStore } from "../../stores/tenantStore";
import type { NetworkSelectorProps } from "../../types";
import { getAvailableNetworks } from "../../types";
import { createLogger, isExtension } from "../../utils";
import { Dropdown } from "../Dropdown";
import Icon from "../Icon";
import Text from "../Text";
import "./NetworkSelector.css";

const log = createLogger();

export const NetworkSelector: React.FC<NetworkSelectorProps> = ({
  chain,
  className = "",
  compact = false,
  onNetworkSwitchStart,
  onRequiresReauth,
  onLocalnetSelected,
}) => {
  const { setChain, forceSetChain, loading } = useNetworkStore();
  const { devMode } = useTenantStore();

  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const isExtensionContext = isExtension();

  const availableNetworks = useMemo(
    () => getAvailableNetworks(devMode, isExtensionContext),
    [devMode, isExtensionContext],
  );

  // If the persisted chain is no longer in availableNetworks (e.g. localnet persisted
  // but dev mode was toggled off), reset to the first available network.
  useEffect(() => {
    if (!availableNetworks.find((n) => n.chain === chain)) {
      forceSetChain(availableNetworks[0].chain);
    }
  }, [availableNetworks, chain, forceSetChain]);

  const handleNetworkSelect = useCallback(
    async (targetChain: SuiChain) => {
      if (targetChain === chain) {
        setIsOpen(false);
        return;
      }

      setIsOpen(false);
      setIsProcessing(true);

      try {
        const result = await setChain(targetChain);

        if (!result.success) {
          log.error("Failed to switch network");
        } else if (result.requiresReauth) {
          onNetworkSwitchStart?.(chain, targetChain);
          onRequiresReauth?.(targetChain);
        } else if (targetChain === SUI_LOCALNET_CHAIN && isExtensionContext) {
          await onLocalnetSelected?.();
        }
        setIsProcessing(false);
      } catch (error) {
        log.error("Failed to switch network", error);
      } finally {
        setIsProcessing(false);
      }
    },
    [
      chain,
      setChain,
      onNetworkSwitchStart,
      onRequiresReauth,
      onLocalnetSelected,
      isExtensionContext,
    ],
  );

  const currentNetwork = useMemo(
    () =>
      availableNetworks.find((n) => n.chain === chain) ?? availableNetworks[0],
    [availableNetworks, chain],
  );

  const isDisabled = loading || isProcessing;

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
          {availableNetworks.map((network) => (
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
