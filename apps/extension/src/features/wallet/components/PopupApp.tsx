import "./PopupApp.css";
import { useAuth } from "@evevault/shared/auth";
import {
  Button,
  CurrentNetworkDisplay,
  HeaderMobile,
  Heading,
  Text,
  TokenListSection,
  useToast,
} from "@evevault/shared/components";
import { useDevice, useEpochExpiration } from "@evevault/shared/hooks";
import { LockScreen } from "@evevault/shared/screens";
import { useDeviceStore } from "@evevault/shared/stores/deviceStore";
import { useNetworkStore } from "@evevault/shared/stores/networkStore";
import { createSuiClient } from "@evevault/shared/sui";
import { createLogger } from "@evevault/shared/utils";
import { useBalance, zkSignAny } from "@evevault/shared/wallet";
import { Transaction } from "@mysten/sui/transactions";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

const log = createLogger();

function App() {
  const navigate = useNavigate();
  const [initError, setInitError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [txDigest, setTxDigest] = useState<string | null>(null);

  const { showToast } = useToast();

  const {
    user,
    login,
    initialize: initializeAuth,
    error: authError,
    loading: authLoading,
  } = useAuth();
  const {
    ephemeralPublicKey,
    isLocked,
    isPinSet,
    getZkProof,
    maxEpoch,
    error: deviceError,
    loading: deviceLoading,
    unlock,
  } = useDevice();
  const { chain, initialize: initializeNetwork } = useNetworkStore();
  const _isLoggedIn = !!user;

  // Use TanStack Query for balance fetching
  const {
    data: suiTokenBalance,
    isLoading: balanceLoading,
    error: balanceError,
  } = useBalance({
    user: user || null,
    chain: chain || null,
  });

  const suiClient = createSuiClient(chain);

  useEffect(() => {
    const initializeStores = async () => {
      try {
        log.info("Initializing stores");
        await initializeAuth();
        await initializeNetwork();

        useDeviceStore.subscribe(async (state, prevState) => {
          log.debug("Device store changed", { state, prevState });
          const storageSnapshot = await chrome.storage.local.get([
            "evevault:device",
          ]);
          log.debug("Storage after change", storageSnapshot);
        });

        log.info("Auth & network stores initialized successfully");
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
  }, []);

  useEpochExpiration();

  const handleLogin = async () => {
    try {
      // TODO: Show login failed if token response is undefined
      const tokenResponse = await login();
      log.info("Login successful", { hasToken: Boolean(tokenResponse) });
    } catch (err) {
      log.error("Login error", err);
    }
  };

  // Determine if user is fully authenticated (unlocked + logged in)
  const _isAuthenticated = !isLocked && !!user;

  // Show loading state while initializing
  if (isInitializing || authLoading || deviceLoading) {
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
        <Button onClick={async () => handleLogin()}>Sign in</Button>
      </>
    );
  }

  const handleTestTransaction = async () => {
    try {
      if (!user || !maxEpoch) {
        log.error("User or max epoch not found", { user, maxEpoch });
        throw new Error("User or max epoch not found");
      }
      if (!ephemeralPublicKey) {
        throw new Error("Ephemeral public key not found");
      }

      const tx = new Transaction();
      tx.setSender(user.profile?.sui_address as string);
      const txb = await tx.build({ client: suiClient });

      const { bytes, zkSignature } = await zkSignAny("TransactionData", txb, {
        user,
        ephemeralPublicKey,
        maxEpoch,
        getZkProof,
      });
      log.debug("zkSignature ready", { length: zkSignature.length });
      log.debug("Transaction bytes ready", { length: bytes.length });

      const txDigest = await suiClient.executeTransactionBlock({
        transactionBlock: bytes,
        signature: zkSignature,
      });

      log.info("Transaction executed", { digest: txDigest.digest });
      setTxDigest(txDigest.digest);
      showToast("Transaction submitted!");
    } catch (error) {
      log.error("Error submitting transaction", error);
      showToast("Error submitting transaction");
    }
  };

  const handleTestTokenRefresh = async () => {
    console.log(user?.refresh_token, user?.id_token, user?.access_token);

    try {
      const fusionAuthUrl = import.meta.env.VITE_FUSION_SERVER_URL;
      const tokenResponse = await fetch(`${fusionAuthUrl}/api/jwt/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-FusionAuth-TenantId": import.meta.env.VITE_FUSION_TENANT_ID,
        },
        body: JSON.stringify({
          refreshToken: user?.refresh_token,
          token: user?.access_token,
        }),
      });
      log.info("Token refreshed", await tokenResponse.json());
    } catch (err) {
      log.error("Token refresh error", err);
    }
  };

  // Authenticated view - show nav
  return (
    <div className="flex flex-col  h-full">
      {/* Header with logo and dropdown */}
      <HeaderMobile
        address={user?.profile?.sui_address as string}
        email={user?.profile?.email as string}
      />

      {/* Token Section */}
      <TokenListSection
        user={user}
        chain={chain || null}
        walletAddress={user?.profile?.sui_address as string}
        onAddToken={() => navigate({ to: "/add-token" })}
      />

      {/* Network display and Test transaction button */}
      <div className=" justify-between  flex items-center gap-4 ">
        <CurrentNetworkDisplay chain={chain} />
        <Button
          variant="secondary"
          size="small"
          onClick={handleTestTransaction}
        >
          Submit test
        </Button>
        <Button
          variant="secondary"
          size="small"
          onClick={handleTestTokenRefresh}
        >
          Test token refresh
        </Button>
      </div>

      {authError && <Text color="error">AuthError: {authError}</Text>}
      {deviceError && <Text color="error">DeviceError: {deviceError}</Text>}
      {txDigest && (
        <Text>
          Transaction digest:{" "}
          <a
            href={`https://suiscan.xyz/${chain?.replace(
              "sui:",
              "",
            )}/tx/${txDigest}`}
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
