import "./PopupApp.css";
import type { TenantId } from "@evefrontier/dapp-kit";
import {
  getAvailableTenantIds,
  getCurrentTenantId,
  isLocalnetChain,
  switchTenantAndReload,
} from "@evevault/shared";
import {
  redirectToFusionAuthLogout,
  resetVaultOnDevice,
  useAuth,
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
  useDevMode,
  useIsAuthenticated,
  useTenant,
} from "@evevault/shared/hooks";
import { LockScreen } from "@evevault/shared/screens";
import { localnetKeyService } from "@evevault/shared/services/vaultService";
import { useNetworkStore } from "@evevault/shared/stores";
import { getFaucetUrlForChain } from "@evevault/shared/sui";
import {
  createLogger,
  EXTENSION_ROUTES,
  getSuiscanUrl,
} from "@evevault/shared/utils";
import { useActiveSuiAddress, useBalance } from "@evevault/shared/wallet";
import type { SuiChain } from "@mysten/wallet-standard";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppInitialization, useLogin } from "@/features/wallet/hooks";
import { APP_VERSION } from "@/lib/appVersion";

const log = createLogger();

function App() {
  const navigate = useNavigate();
  const { initError, isInitializing } = useAppInitialization();
  const { devMode, setDevMode } = useTenant();
  const [previousNetworkBeforeSwitch, setPreviousNetworkBeforeSwitch] =
    useState<SuiChain | null>(null);

  const { user, loading: authLoading, error: authError } = useAuth();
  const { isLocked, isPinSet, error: deviceError, unlock } = useDevice();
  const { chain, localnetUrl } = useNetworkStore();
  const isAuthenticated = useIsAuthenticated();
  const isLocalnet = isLocalnetChain(chain);
  const faucetUrl = getFaucetUrlForChain(chain);
  const { handleLogin } = useLogin();
  const { handleTestTransaction, txDigest, handleRotateEphKey } = useDevMode();
  const activeAddress = useActiveSuiAddress();

  // Use TanStack Query for balance fetching
  useBalance({
    user: user || null,
    chain: chain || null,
    address: activeAddress, // localnet address or zkLogin address
    localnetUrl,
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
    const success = await handleLogin();
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

  if (!isAuthenticated) {
    if (isLocked && isPinSet) {
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

    if (isLocalnet) {
      return (
        <div className="flex flex-col items-center justify-between gap-4 w-full h-full">
          <section className="flex flex-col items-center gap-10 w-full flex-1">
            <img
              src="/images/logo.png"
              alt="EVE Vault"
              className="h-20 w-auto"
            />
            <header className="flex flex-col items-center gap-4 text-center">
              <Heading level={2}>Localnet setup</Heading>
              <Text variant="light" size="large">
                Load a localnet keypair to continue.
              </Text>
            </header>
            <div className="w-full max-w-[300px]">
              <Button
                size="fill"
                onClick={() =>
                  navigate({ to: EXTENSION_ROUTES.LOCALNET_SETTINGS })
                }
              >
                Open Localnet Settings
              </Button>
            </div>
          </section>
        </div>
      );
    }

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
          {isPinSet && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await resetVaultOnDevice();
                  navigate({ to: "/" });
                } catch (error) {
                  log.error("Failed to reset vault", error);
                }
              }}
              className="text-sm underline text-grey-neutral hover:text-neutral focus:outline-none focus:ring-2 focus:ring-primary rounded"
            >
              Forgot PIN
            </button>
          )}
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
        address={activeAddress ?? ""}
        email={user?.profile?.email ?? ""}
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
        onLocalnetSettingsClick={
          devMode
            ? () => navigate({ to: EXTENSION_ROUTES.LOCALNET_SETTINGS })
            : undefined
        }
        version={APP_VERSION}
      />

      {/* Token Section */}
      <TokenListSection
        user={user}
        chain={chain || null}
        walletAddress={activeAddress ?? ""}
        balanceAddress={activeAddress}
        localnetUrl={localnetUrl}
        onAddToken={() => navigate({ to: "/add-token" })}
        onSendToken={(coinType) =>
          navigate({ to: "/send-token", search: { coinType } })
        }
      />

      {/* Network selector and test tx result */}
      <div className="justify-between flex items-center gap-4">
        <NetworkSelector
          chain={chain}
          onLocalnetSelected={async () => {
            const addr = await localnetKeyService
              .getAddress()
              .catch(() => null);
            if (!addr) {
              log.info(
                "No localnet keypair found, navigating to settings page",
              );
              navigate({ to: EXTENSION_ROUTES.LOCALNET_SETTINGS });
            }
          }}
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
            href={
              chain
                ? getSuiscanUrl(chain, txDigest, {
                    localnetUrl: localnetUrl ?? undefined,
                  })
                : "#"
            }
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
