import { useAuthStore } from "@evevault/shared/auth";
import { useNetworkStore } from "@evevault/shared/stores";
import { AVAILABLE_NETWORKS, getNetworkLabel } from "@evevault/shared/types";
import { createLogger, isExtension } from "@evevault/shared/utils";
import type { SuiChain } from "@mysten/wallet-standard";
import { type FC, useCallback, useMemo, useState } from "react";
import Button from "../Button";
import Icon from "../Icon";
import Text from "../Text";
import "./style.css";

const log = createLogger();

export interface NetworkSelectorProps {
  /** Compact mode shows only the network badge */
  compact?: boolean;
  /** Callback when network switch requires re-authentication */
  onRequiresReauth?: (targetNetwork: SuiChain) => void;
}

export const NetworkSelector: FC<NetworkSelectorProps> = ({
  compact = false,
  onRequiresReauth,
}) => {
  const { chain, setChain, checkNetworkSwitch, loading } = useNetworkStore();
  const { initialize: initializeAuth } = useAuthStore();

  const [isOpen, setIsOpen] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingNetwork, setPendingNetwork] = useState<SuiChain | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const currentNetwork = useMemo(
    () =>
      AVAILABLE_NETWORKS.find((n) => n.chain === chain) ??
      AVAILABLE_NETWORKS[0],
    [chain],
  );

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

    // Notify parent if callback provided
    onRequiresReauth?.(pendingNetwork);

    // Force set the target network
    // This persists the network choice so login flow uses it
    // We use forceSetChain because we know we don't have a JWT for this network
    useNetworkStore.getState().forceSetChain(pendingNetwork);

    // Re-initialize auth store to check JWT for new network
    await initializeAuth();

    setShowConfirmDialog(false);
    setPendingNetwork(null);
    setIsProcessing(false);
  }, [pendingNetwork, initializeAuth, onRequiresReauth]);

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
        className={`network-selector ${
          isExtensionContext ? "network-selector--extension" : ""
        }`}
      >
        {compact ? (
          <button
            className="network-selector__badge"
            onClick={() => setIsOpen(!isOpen)}
            disabled={isDisabled}
            type="button"
          >
            <Text size="small" variant="bold" color="neutral">
              {currentNetwork.shortLabel}
            </Text>
          </button>
        ) : (
          <button
            className="network-selector__trigger"
            onClick={() => setIsOpen(!isOpen)}
            disabled={isDisabled}
            type="button"
          >
            <Text size="medium" variant="regular" color="neutral">
              {currentNetwork.label}
            </Text>
            <Icon
              name="ChevronArrowDown"
              width={16}
              height={16}
              color="neutral"
              className={`network-selector__chevron ${isOpen ? "network-selector__chevron--open" : ""}`}
            />
          </button>
        )}

        {isOpen && (
          <div className="network-selector__dropdown">
            {AVAILABLE_NETWORKS.map((network) => (
              <button
                key={network.chain}
                className={`network-selector__option ${
                  network.chain === chain
                    ? "network-selector__option--active"
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
                  <span className="network-selector__check">✓</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sign In Required Dialog */}
      {showConfirmDialog && (
        <div className="network-selector__overlay">
          <div className="network-selector__dialog">
            <Text size="large" variant="bold" color="neutral">
              Sign In Required
            </Text>
            <Text
              size="medium"
              variant="regular"
              color="grey-neutral"
              className="network-selector__dialog-message"
            >
              You haven't signed in on {pendingNetworkLabel} yet. Sign in to
              continue on this network.
            </Text>
            <div className="network-selector__dialog-actions">
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

export default NetworkSelector;
