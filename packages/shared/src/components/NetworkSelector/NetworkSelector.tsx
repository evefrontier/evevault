import type { SuiChain } from "@mysten/wallet-standard";
import type React from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useAuthStore } from "../../auth";
import { useNetworkStore } from "../../stores";
import type { NetworkSelectorProps } from "../../types";
import { AVAILABLE_NETWORKS, getNetworkLabel } from "../../types";
import { createLogger, isExtension } from "../../utils";
import Icon from "../Icon";
import { Modal } from "../Modal";
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
  const { setChain, checkNetworkSwitch, loading } = useNetworkStore();
  const { initialize: initializeAuth } = useAuthStore();

  const [isOpen, setIsOpen] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingNetwork, setPendingNetwork] = useState<SuiChain | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleNetworkSelect = useCallback(
    async (targetChain: SuiChain) => {
      if (targetChain === chain) {
        setIsOpen(false);
        return;
      }

      setIsProcessing(true);

      // Check if switching requires re-authentication
      const { requiresReauth } = await checkNetworkSwitch(targetChain);

      if (requiresReauth) {
        // Show confirmation dialog
        setPendingNetwork(targetChain);
        setShowConfirmDialog(true);
        setIsOpen(false);
        setIsProcessing(false);
        return;
      }

      // Seamless switch - we have a token for this network
      const result = await setChain(targetChain);

      if (!result.success) {
        log.error("Failed to switch network");
      }

      setIsOpen(false);
      setIsProcessing(false);
    },
    [chain, checkNetworkSwitch, setChain],
  );

  const handleConfirmReauth = useCallback(async () => {
    if (!pendingNetwork) return;

    setIsProcessing(true);

    // Store previous network before switching (for rollback on failure)
    const currentChain = useNetworkStore.getState().chain;

    // Notify parent component about network switch
    onNetworkSwitchStart?.(currentChain, pendingNetwork);
    onRequiresReauth?.(pendingNetwork);

    // Force set the target network
    useNetworkStore.getState().forceSetChain(pendingNetwork);

    // Re-initialize auth store to check JWT for new network
    await initializeAuth();

    setShowConfirmDialog(false);
    setPendingNetwork(null);
    setIsProcessing(false);
  }, [pendingNetwork, initializeAuth, onNetworkSwitchStart, onRequiresReauth]);

  const handleCancelReauth = useCallback(() => {
    setShowConfirmDialog(false);
    setPendingNetwork(null);
  }, []);

  const pendingNetworkLabel = useMemo(
    () => (pendingNetwork ? getNetworkLabel(pendingNetwork) : ""),
    [pendingNetwork],
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
    <>
      <div
        className={`network-selector ${
          isExtensionContext ? "network-selector--extension" : ""
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
            className="network-selector__trigger"
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
              className={`network-selector__chevron ${
                isOpen ? "network-selector__chevron--open" : ""
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

      {/* Sign In Required Dialog */}
      <Modal
        isOpen={showConfirmDialog}
        onClose={handleCancelReauth}
        title="Sign In Required"
        message={`You haven't signed in on ${pendingNetworkLabel} yet. Sign in to continue on this network.`}
        secondaryAction={{
          label: "Cancel",
          onClick: handleCancelReauth,
          disabled: isProcessing,
        }}
        primaryAction={{
          label: "Sign In",
          onClick: handleConfirmReauth,
          isLoading: isProcessing,
        }}
      />
    </>
  );
};

export default NetworkSelector;
