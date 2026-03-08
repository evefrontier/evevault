import "./PopupApp.css";
import {
  getAvailableTenantIds,
  getTenantLabel,
  handleTestTokenRefresh,
  switchTenantAndReload,
  type TenantId,
  useAuth,
  useTenantStore,
} from "@evevault/shared/auth";
import {
  Button,
  HeaderMobile,
  Heading,
  NetworkSelector,
  TenantSelector,
  Text,
  TokenListSection,
} from "@evevault/shared/components";
import Icon from "@evevault/shared/components/Icon";
import {
  useDevice,
  useEpochExpiration,
  useTestTransaction,
} from "@evevault/shared/hooks";
import { LockScreen } from "@evevault/shared/screens";
import { useNetworkStore } from "@evevault/shared/stores/networkStore";
import {
  createLogger,
  EXTENSION_ROUTES,
  getDevModeEnabled,
  getSuiscanUrl,
  setDevModeEnabled,
} from "@evevault/shared/utils";
import { useBalance } from "@evevault/shared/wallet";
import type { SuiChain } from "@mysten/wallet-standard";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useAppInitialization, useLogin } from "../hooks";

const log = createLogger();

function App() {
  const navigate = useNavigate();
  const { initError, isInitializing } = useAppInitialization();
  const [devMode, setDevMode] = useState(false);
  const [previousNetworkBeforeSwitch, setPreviousNetworkBeforeSwitch] =
    useState<SuiChain | null>(null);

  const { user, loading: authLoading, error: authError } = useAuth();
  const { isLocked, isPinSet, error: deviceError, unlock } = useDevice();
  const { chain } = useNetworkStore();
  const { handleLogin } = useLogin();
  const { nonce } = useDevice();
  const { handleTestTransaction, txDigest } = useTestTransaction();

  // Use TanStack Query for balance fetching
  useBalance({
    user: user || null,
    chain: chain || null,
  });

  useEpochExpiration();

  // Clear previous network tracking when user successfully logs in
  useEffect(() => {
    if (user && previousNetworkBeforeSwitch) {
      log.info(
        "User logged in successfully, clearing previous network tracking",
      );
      setPreviousNetworkBeforeSwitch(null);
    }
  }, [user, previousNetworkBeforeSwitch]);

  useEffect(() => {
    getDevModeEnabled().then(setDevMode);
  }, []);

  const tenantId = useTenantStore((s) => s.tenantId);

  const handleDevModeToggle = useCallback(async () => {
    const next = !devMode;
    setDevMode(next);
    await setDevModeEnabled(next);
  }, [devMode]);

  const onLoginClick = async () => {
    const success = await handleLogin(previousNetworkBeforeSwitch);
    if (success) {
      setPreviousNetworkBeforeSwitch(null);
    }
  };

  const handleTokenRefreshTest = useCallback(async () => {
    if (!user) return;
    if (!nonce) {
      const message =
        "Cannot refresh token because the device nonce is not available. Please unlock your wallet or try again.";
      log.error(message);
      // Show explicit feedback to the user instead of proceeding with an invalid nonce
      window.alert(message);
      return;
    }
    await handleTestTokenRefresh(user, nonce);
  }, [user, nonce]);

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
            availableTenantIds={getAvailableTenantIds()}
            onServerChange={(tenantId) =>
              switchTenantAndReload(tenantId as TenantId)
            }
          />
        </section>
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
        onTokenRefreshTestClick={devMode ? handleTokenRefreshTest : undefined}
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

        <div className="tenant-selector--inline">
          <div
            className="tenant-selector__trigger"
            style={{ cursor: "default" }}
          >
            <Icon name="Network" color="quantum" />
            <Text variant="label-medium" size="medium">
              {getTenantLabel(tenantId)}
            </Text>
          </div>
        </div>
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
