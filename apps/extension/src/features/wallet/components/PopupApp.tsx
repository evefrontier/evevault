import "./PopupApp.css";
import { useAuth } from "@evevault/shared/auth";
import {
  Button,
  CurrentNetworkDisplay,
  HeaderMobile,
  Heading,
  Text,
  TokenListSection,
} from "@evevault/shared/components";
import { useDevice, useEpochExpiration } from "@evevault/shared/hooks";
import { LockScreen } from "@evevault/shared/screens";
import { useNetworkStore } from "@evevault/shared/stores/networkStore";
import {
  createLogger,
  EXTENSION_ROUTES,
  getSuiscanUrl,
} from "@evevault/shared/utils";
import { useBalance } from "@evevault/shared/wallet";
import type { SuiChain } from "@mysten/wallet-standard";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAppInitialization, useLogin, useTestTransaction } from "../hooks";

const log = createLogger();

function App() {
  const navigate = useNavigate();
  const { initError, isInitializing } = useAppInitialization();
  const [previousNetworkBeforeSwitch, setPreviousNetworkBeforeSwitch] =
    useState<SuiChain | null>(null);

  const { user, error: authError } = useAuth();
  const { isLocked, isPinSet, error: deviceError, unlock } = useDevice();
  const { chain } = useNetworkStore();
  const { handleLogin } = useLogin();
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

  const onLoginClick = async () => {
    const success = await handleLogin(previousNetworkBeforeSwitch);
    if (success) {
      setPreviousNetworkBeforeSwitch(null);
    }
  };

  // Show loading state while initializing
  if (isInitializing) {
    return (
      <>
        <Heading level={1} variant="bold">
          EVE Vault
        </Heading>
        <Text>Loading...</Text>
      </>
    );
  }

  if (initError) {
    return (
      <>
        <Heading level={1} variant="bold">
          EVE Vault
        </Heading>
        <Text color="error">Error: {initError}</Text>
        <Button onClick={() => window.location.reload()}>Reload</Button>
      </>
    );
  }

  // First, check for unencrypted ephemeral key pair
  if (isLocked) {
    return <LockScreen isPinSet={isPinSet} unlock={unlock} />;
  }

  // If ephemeral keypair exists, but user is not logged in, show login screen
  if (!user) {
    return (
      <>
        <Heading level={1} variant="bold">
          EVE Vault
        </Heading>
        <Button onClick={onLoginClick}>Sign in</Button>
      </>
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
