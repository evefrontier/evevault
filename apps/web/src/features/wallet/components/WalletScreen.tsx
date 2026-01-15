import {
  CurrentNetworkDisplay,
  HeaderMobile,
  LockScreen,
} from "@evevault/shared";
import { useAuth } from "@evevault/shared/auth";
import {
  Background,
  Button,
  Heading,
  Text,
  TokenListSection,
} from "@evevault/shared/components";
import {
  useDevice,
  useEpochExpiration,
  useTestTransaction,
} from "@evevault/shared/hooks";
import { useDeviceStore } from "@evevault/shared/stores/deviceStore";
import { useNetworkStore } from "@evevault/shared/stores/networkStore";
import { createLogger } from "@evevault/shared/utils";
import { useBalance } from "@evevault/shared/wallet";
import type { SuiChain } from "@mysten/wallet-standard";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

const log = createLogger();

export const WalletScreen = () => {
  const navigate = useNavigate();
  const [initError, setInitError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [previousNetworkBeforeSwitch, setPreviousNetworkBeforeSwitch] =
    useState<SuiChain | null>(null);
  const { handleTestTransaction, txDigest } = useTestTransaction();

  const {
    user,
    login,
    initialize: initializeAuth,
    error: authError,
    loading: authLoading,
  } = useAuth();
  const {
    isLocked,
    isPinSet,
    error: deviceError,
    loading: deviceLoading,
    unlock,
  } = useDevice();
  const { chain } = useNetworkStore();

  // Use TanStack Query for balance fetching
  const {
    data: suiTokenBalance,
    isLoading: balanceLoading,
    error: balanceError,
  } = useBalance({
    user: user || null,
    chain: chain || null,
  });

  useEffect(() => {
    const initializeStores = async () => {
      try {
        log.info("Initializing stores");
        await initializeAuth();
        await useNetworkStore.getState().initialize();

        const networkState = useNetworkStore.getState();
        log.debug("Network state after init", networkState);

        useDeviceStore.subscribe(async (state, prevState) => {
          log.debug("Device store changed", { state, prevState });
        });

        log.info("Stores initialized successfully");
        setIsInitializing(false);
      } catch (error) {
        log.error("Error initializing stores", error);
        setInitError(
          error instanceof Error ? error.message : "Failed to initialize",
        );
        setIsInitializing(false);
      }
    };

    initializeStores();
  }, [initializeAuth]);

  // Monitor epoch expiration and auto-logout when maxEpochTimestampMs is reached
  useEpochExpiration();

  const handleLogin = async () => {
    try {
      await login();
      log.info("Login successful");
    } catch (err) {
      log.error("Login error", err);
    }
  };

  // Show loading state while initializing
  if (isInitializing || authLoading || deviceLoading) {
    return (
      <Background>
        <header className="app-shell__header">
          <Heading level={1} variant="bold">
            EVE Vault
          </Heading>
        </header>
        <main className="app-shell__content">
          <Text>Loading...</Text>
        </main>
      </Background>
    );
  }

  if (initError) {
    return (
      <Background>
        <header className="app-shell__header">
          <Heading level={1} variant="bold">
            EVE Vault
          </Heading>
        </header>
        <main className="app-shell__content">
          <Text color="error">Error: {initError}</Text>
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </main>
      </Background>
    );
  }

  // First, check for unencrypted ephemeral key pair
  if (isLocked) {
    return <LockScreen isPinSet={isPinSet} unlock={unlock} />;
  }

  if (!user) {
    return (
      <Background>
        <header className="app-shell__header">
          <Heading level={1} variant="bold">
            EVE Vault
          </Heading>
        </header>
        <main className="app-shell__content">
          <Button onClick={async () => handleLogin()}>Sign in</Button>
        </main>
      </Background>
    );
  }

  return (
    <div>
      <HeaderMobile
        address={user?.profile?.sui_address as string}
        email={user?.profile?.email as string}
      />
      <main>
        {/* Token Section */}
        <TokenListSection
          user={user}
          chain={chain || null}
          walletAddress={user?.profile?.sui_address as string}
          onAddToken={() => navigate({ to: "/wallet/add-token" })}
        />
        {/* Network display and Test transaction button */}
        <div className=" justify-between  flex items-center gap-4 ">
          <CurrentNetworkDisplay
            chain={chain}
            onNetworkSwitchStart={(previousNetwork, targetNetwork) => {
              log.info("Network switch started", {
                previousNetwork,
                targetNetwork,
              });
              setPreviousNetworkBeforeSwitch(previousNetwork as SuiChain);
            }}
          />
          <Button
            variant="secondary"
            size="small"
            onClick={handleTestTransaction}
          >
            Submit test
          </Button>
        </div>
        {txDigest && (
          <div>
            <Text>
              Tx digest:{" "}
              <a
                href={`https://suiscan.xyz/${chain.replace(
                  "sui:",
                  "",
                )}/tx/${txDigest}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--quantum)" }}
              >
                {txDigest}
              </a>
            </Text>
          </div>
        )}
        {authError && <Text color="error">Error: {authError}</Text>}
        {deviceError && <Text color="error">Error: {deviceError}</Text>}
      </main>
      <footer className="app-shell__footer" />
    </div>
  );
};
