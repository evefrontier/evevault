import type { SuiChain } from "@mysten/wallet-standard";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { useAuthStore } from "../../auth";
import { useNetworkStore } from "../../stores";
import type { CurrentNetworkDisplayProps } from "../../types";
import { AVAILABLE_NETWORKS, getNetworkLabel } from "../../types";
import { createLogger, isExtension } from "../../utils";
import Button from "../Button";
import Icon from "../Icon";
import Text from "../Text";
import "./CurrentNetworkDisplay.css";

const log = createLogger();

export const CurrentNetworkDisplay: React.FC<CurrentNetworkDisplayProps> = ({
  chain,
  className = "",
  onNetworkSwitchStart,
}) => {
  const { setChain, checkNetworkSwitch, loading } = useNetworkStore();
  const { initialize: initializeAuth } = useAuthStore();

  const [isOpen, setIsOpen] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingNetwork, setPendingNetwork] = useState<SuiChain | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

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

    // Force set the target network
    useNetworkStore.getState().forceSetChain(pendingNetwork);

    // Re-initialize auth store to check JWT for new network
    await initializeAuth();

    setShowConfirmDialog(false);
    setPendingNetwork(null);
    setIsProcessing(false);
  }, [pendingNetwork, initializeAuth, onNetworkSwitchStart]);

  const handleCancelReauth = useCallback(() => {
    setShowConfirmDialog(false);
    setPendingNetwork(null);
  }, []);

  const pendingNetworkLabel = useMemo(
    () => (pendingNetwork ? getNetworkLabel(pendingNetwork) : ""),
    [pendingNetwork],
  );

  const isDisabled = loading || isProcessing;
  const isExtensionContext = isExtension();

  return (
    <>
      <div
        className={`current-network-display ${
          isExtensionContext ? "current-network-display--extension" : ""
        } ${className}`}
      >
        <button
          type="button"
          className="current-network-display__trigger"
          onClick={() => !isDisabled && setIsOpen(!isOpen)}
          disabled={isDisabled}
        >
          <Icon name="Network" color="quantum" />
          <div className="flex flex-col gap-0.5">
            <Text variant="label-small" color="neutral-50" size="small">
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
            className={`current-network-display__chevron ${
              isOpen ? "current-network-display__chevron--open" : ""
            }`}
          />
        </button>

        {isOpen && (
          <div className="current-network-display__dropdown">
            {AVAILABLE_NETWORKS.map((network) => (
              <button
                key={network.chain}
                className={`current-network-display__option ${
                  network.chain === chain
                    ? "current-network-display__option--active"
                    : ""
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
                  <span className="current-network-display__check">✓</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sign In Required Dialog */}
      {showConfirmDialog && (
        <div className="current-network-display__overlay">
          <div className="current-network-display__dialog">
            <Text size="large" variant="bold" color="neutral">
              Sign In Required
            </Text>
            <Text
              size="medium"
              variant="regular"
              color="grey-neutral"
              className="current-network-display__dialog-message"
            >
              You haven't signed in on {pendingNetworkLabel} yet. Sign in to
              continue on this network.
            </Text>
            <div className="current-network-display__dialog-actions">
              <Button
                variant="secondary"
                size="medium"
                onClick={handleCancelReauth}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="medium"
                onClick={handleConfirmReauth}
                isLoading={isProcessing}
              >
                Sign In
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CurrentNetworkDisplay;
