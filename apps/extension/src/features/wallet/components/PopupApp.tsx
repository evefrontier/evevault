import "./PopupApp.css";
import {
  getAvailableTenantIds,
  getCurrentTenantId,
  switchTenantAndReload,
  type TenantId,
} from "@evevault/shared";
import { redirectToFusionAuthLogout, useAuth } from "@evevault/shared/auth";
import {
  Button,
  HeaderMobile,
  Heading,
  NetworkSelector,
  TenantSelector,
  Text,
  TokenListSection,
  useToast,
} from "@evevault/shared/components";
import Icon from "@evevault/shared/components/Icon";
import {
  useDevice,
  useTenant,
  useTestTransaction,
} from "@evevault/shared/hooks";
import { LockScreen } from "@evevault/shared/screens";
import { useDeviceStore, useNetworkStore } from "@evevault/shared/stores";
import { getFaucetUrlForChain } from "@evevault/shared/sui";
import {
  createLogger,
  EXTENSION_ROUTES,
  getSuiscanUrl,
} from "@evevault/shared/utils";
import { useBalance } from "@evevault/shared/wallet";
import type { SuiChain } from "@mysten/wallet-standard";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { APP_VERSION } from "../../../lib/appVersion";
import { useAppInitialization, useLogin } from "../hooks";

const log = createLogger();

function App() {
  const navigate = useNavigate();
  const { initError, isInitializing } = useAppInitialization();
  const { devMode, setDevMode } = useTenant();
  const [previousNetworkBeforeSwitch, setPreviousNetworkBeforeSwitch] =
    useState<SuiChain | null>(null);

  const { user, loading: authLoading, error: authError } = useAuth();
  const {
    isLocked,
    isPinSet,
    error: deviceError,
    unlock,
    rotateEphemeralKey,
  } = useDevice();
  const { chain } = useNetworkStore();
  const { showToast } = useToast();
  const faucetUrl = getFaucetUrlForChain(chain);
  const { handleLogin } = useLogin();
  const { handleTestTransaction, txDigest } = useTestTransaction();

  const formatPublicKey = useCallback((bytes: number[] | null | undefined) => {
    if (!bytes || bytes.length === 0) return null;
    return bytes
      .slice(0, 8)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }, []);

  const handleRotateEphKey = useCallback(async () => {
    const beforeState = useDeviceStore.getState();
    const beforeChainData = beforeState.networkData[chain];
    const beforeKey = formatPublicKey(beforeState.ephemeralPublicKeyBytes);

    log.info("Manual eph key rotation requested", {
      chain,
      beforeKey,
      beforeChainData,
    });

    try {
      await rotateEphemeralKey();

      const afterState = useDeviceStore.getState();
      const afterChainData = afterState.networkData[chain];
      const afterKey = formatPublicKey(afterState.ephemeralPublicKeyBytes);

      log.info("Manual eph key rotation completed", {
        chain,
        beforeKey,
        afterKey,
        beforeChainData,
        afterChainData,
      });

      showToast("Ephemeral key rotated");
    } catch (error) {
      log.error("Manual eph key rotation failed", error);
      showToast("Failed to rotate eph key");
    }
  }, [chain, formatPublicKey, rotateEphemeralKey, showToast]);

  // Use TanStack Query for balance fetching
  useBalance({
    user: user || null,
    chain: chain || null,
  });

  // Clear previous network tracking when user successfully logs in
  useEffect(() => {
    if (user && previousNetworkBeforeSwitch) {
      log.info(
        "User logged in successfully, clearing previous network tracking",
      );
      setPreviousNetworkBeforeSwitch(null);
    }
  }, [user, previousNetworkBeforeSwitch]);

  const availableTenantIds = useMemo(
    () => getAvailableTenantIds(devMode),
    [devMode],
  );
  const tenantId = getCurrentTenantId();

  const handleDevModeToggle = useCallback(() => {
    setDevMode(!devMode);
  }, [devMode, setDevMode]);

  const onLoginClick = async () => {
    const success = await handleLogin(previousNetworkBeforeSwitch);
    if (success) {
      setPreviousNetworkBeforeSwitch(null);
    }
  };

  // Show loading state while initializing
  if (isInitializing) {
    return (
      <div className="flex flex-col items-center justify-between gap-4 w-full h-full">
        <section className="flex flex-col items-center gap-10 w-full flex-1">
          <img src="/images/logo.png" alt="EVE Vault" className="h-20 w-auto" />
          <header className="flex flex-col items-center gap-4 text-center">
            <Heading level={2}>Loading...</Heading>
            <Text variant="light" size="large">
              Preparing your wallet
            </Text>
          </header>
        </section>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="flex flex-col items-center justify-between gap-4 w-full h-full">
        <section className="flex flex-col items-center gap-10 w-full flex-1">
          <img src="/images/logo.png" alt="EVE Vault" className="h-20 w-auto" />
          <header className="flex flex-col items-center gap-4 text-center">
            <Heading level={2}>Error</Heading>
            <Text color="error">Error: {initError}</Text>
            <div className="w-full max-w-[300px]">
              <Button size="fill" onClick={() => window.location.reload()}>
                Reload
              </Button>
            </div>
          </header>
        </section>
      </div>
    );
  }

  // First, check for unencrypted ephemeral key pair
  if (isLocked) {
    return (
      <LockScreen
        isPinSet={isPinSet}
        unlock={unlock}
        onResetComplete={() => {
          redirectToFusionAuthLogout();
          navigate({ to: "/" });
        }}
      />
    );
  }

  // If ephemeral keypair exists, but user is not logged in, show login screen
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-between gap-4 w-full h-full">
        <section className="flex flex-col items-center gap-10 w-full flex-1">
          <img src="/images/logo.png" alt="EVE Vault" className="h-20 w-auto" />
          <header className="flex flex-col items-center gap-4 text-center">
            <Heading level={2}>Sign in</Heading>
          </header>
          <div className="w-full max-w-[300px]">
            <Button size="fill" onClick={onLoginClick} disabled={authLoading}>
              {authLoading ? "Loading..." : "Login"}
            </Button>
          </div>
          <TenantSelector
            currentTenantId={tenantId}
            availableTenantIds={availableTenantIds}
            onServerChange={(tenantId) =>
              switchTenantAndReload(tenantId as TenantId)
            }
          />
        </section>
        <Button
          variant="secondary"
          size="small"
          className="absolute! bottom-4 right-4"
          onClick={handleDevModeToggle}
        >
          <Icon
            name={devMode ? "Eye" : "HideEye"}
            color="#ED4136"
            size="small"
          />
        </Button>
      </div>
    );
  }

  // Authenticated view - show nav
  return (
    <div className="flex flex-col  h-full">
      {/* Header with logo and dropdown */}
      <HeaderMobile
        address={user?.profile?.sui_address as string}
        email={user?.profile?.email as string}
        onTransactionsClick={() =>
          navigate({ to: EXTENSION_ROUTES.TRANSACTIONS })
        }
        showDevActions={devMode}
        onDevModeToggle={handleDevModeToggle}
        onSignSubmitTxClick={devMode ? handleTestTransaction : undefined}
        onRotateEphKeyClick={devMode ? handleRotateEphKey : undefined}
        onFaucetTestSuiClick={
          devMode && faucetUrl
            ? () => window.open(faucetUrl, "_blank", "noopener,noreferrer")
            : undefined
        }
        version={APP_VERSION}
      />

      {/* Token Section */}
      <TokenListSection
        user={user}
        chain={chain || null}
        walletAddress={user?.profile?.sui_address as string}
        onAddToken={() => navigate({ to: "/add-token" })}
        onSendToken={(coinType) =>
          navigate({ to: "/send-token", search: { coinType } })
        }
      />

      {/* Network selector and test tx result */}
      <div className="justify-between flex items-center gap-4">
        <NetworkSelector
          chain={chain}
          onNetworkSwitchStart={(previousNetwork, targetNetwork) => {
            log.info("Network switch started", {
              previousNetwork,
              targetNetwork,
            });
            setPreviousNetworkBeforeSwitch(previousNetwork as SuiChain);
          }}
        />

        <TenantSelector currentTenantId={tenantId} viewOnly={true} />
      </div>

      {authError && <Text color="error">AuthError: {authError}</Text>}
      {deviceError && <Text color="error">DeviceError: {deviceError}</Text>}
      {txDigest && (
        <Text>
          Transaction digest:{" "}
          <a
            href={chain ? getSuiscanUrl(chain, txDigest) : "#"}
            target="_blank"
            rel="noopener noreferrer"
          >
            {txDigest}
          </a>
        </Text>
      )}
    </div>
  );
}

export default App;
