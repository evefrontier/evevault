import { LockScreen } from "@evevault/shared";
import { useAuth } from "@evevault/shared/auth";
import {
  Background,
  Button,
  Heading,
  Text,
  TokenListSection,
} from "@evevault/shared/components";
import {
  useCopyToClipboard,
  useDevice,
  useEpochExpiration,
} from "@evevault/shared/hooks";
import { useDeviceStore } from "@evevault/shared/stores/deviceStore";
import { useNetworkStore } from "@evevault/shared/stores/networkStore";
import { createSuiClient } from "@evevault/shared/sui";
import { createLogger, formatAddress } from "@evevault/shared/utils";
import { useBalance, zkSignAny } from "@evevault/shared/wallet";
import { Transaction } from "@mysten/sui/transactions";
import { SUI_DEVNET_CHAIN, SUI_TESTNET_CHAIN } from "@mysten/wallet-standard";
import { useNavigate } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";

const log = createLogger();

export const WalletScreen = () => {
  const navigate = useNavigate();
  const [txDigest, setTxDigest] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const { copy: copyAddress } = useCopyToClipboard();

  const {
    user,
    login,
    logout,
    initialize: initializeAuth,
    error: authError,
    loading: authLoading,
  } = useAuth();
  const {
    isLocked,
    isPinSet,
    getZkProof,
    maxEpoch,
    ephemeralPublicKey,
    error: deviceError,
    loading: deviceLoading,
    unlock,
    lock,
  } = useDevice();
  const { chain, setChain } = useNetworkStore();
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

  // Create suiClient with useMemo to recreate when chain changes
  const suiClient = React.useMemo(() => {
    // Use chain from store if available, otherwise default to devnet
    const currentChain = chain || SUI_DEVNET_CHAIN;
    log.debug("Creating SuiClient for chain", { chain: currentChain });
    return createSuiClient(currentChain);
  }, [chain]);

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

  const handleLogout = async () => {
    try {
      await logout();
      log.info("Logged out");
    } catch (err) {
      log.error("Logout error", err);
    }
  };

  // Show loading state while initializing
  if (isInitializing || authLoading || deviceLoading) {
    return (
      <Background>
        <div className="app-shell">
          <header className="app-shell__header">
            <Heading level={1} variant="bold">
              EVE Vault
            </Heading>
          </header>
          <main className="app-shell__content">
            <Text>Loading...</Text>
          </main>
        </div>
      </Background>
    );
  }

  if (initError) {
    return (
      <Background>
        <div className="app-shell">
          <header className="app-shell__header">
            <Heading level={1} variant="bold">
              EVE Vault
            </Heading>
          </header>
          <main className="app-shell__content">
            <Text color="error">Error: {initError}</Text>
            <Button onClick={() => window.location.reload()}>Reload</Button>
          </main>
        </div>
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
        <div className="app-shell">
          <header className="app-shell__header">
            <Heading level={1} variant="bold">
              EVE Vault
            </Heading>
          </header>
          <main className="app-shell__content">
            <Button onClick={async () => handleLogin()}>Sign in</Button>
          </main>
        </div>
      </Background>
    );
  }

  return (
    <Background>
      <div className="app-shell">
        <header className="app-shell__header">
          <Heading level={1} variant="bold">
            EVE Vault
          </Heading>
          <div style={{ marginTop: "12px" }}>
            <Button
              onClick={() => {
                // Toggle between devnet and testnet
                const newChain =
                  chain === SUI_DEVNET_CHAIN
                    ? SUI_TESTNET_CHAIN
                    : SUI_DEVNET_CHAIN;
                setChain(newChain);
              }}
            >
              {chain === SUI_TESTNET_CHAIN ? "Testnet" : "Devnet"}
            </Button>
          </div>
        </header>
        <main className="app-shell__content">
          <div>
            <Text>ZK Login User Address:</Text>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginTop: "8px",
                marginBottom: "8px",
              }}
            >
              <Text style={{ wordBreak: "break-all", flex: 1 }}>
                {formatAddress(user?.profile?.sui_address as string)}
              </Text>
              <Button
                variant="secondary"
                size="xs"
                onClick={() =>
                  copyAddress(user?.profile?.sui_address as string)
                }
              >
                📋
              </Button>
            </div>
            <Text data-testid="wallet-balance">
              Sui token balance on {chain}:{" "}
              {balanceLoading
                ? "Loading..."
                : (suiTokenBalance?.formattedBalance ?? "0")}
            </Text>
            {balanceError && (
              <Text color="error">
                Error loading balance:{" "}
                {balanceError instanceof Error
                  ? balanceError.message
                  : "Unknown error"}
              </Text>
            )}
            <Button onClick={handleLogout}>Logout</Button>
            <Button onClick={lock}>Lock</Button>

            <div>
              <Button
                onClick={async () => {
                  if (!user || !maxEpoch) return;
                  if (!ephemeralPublicKey) {
                    throw new Error(
                      "[Wallet Screen] Ephemeral public key not found",
                    );
                  }

                  const tx = new Transaction();
                  tx.setSender(user.profile?.sui_address as string);
                  const txb = await tx.build({ client: suiClient });

                  const { bytes, zkSignature } = await zkSignAny(
                    "TransactionData",
                    txb,
                    {
                      user,
                      ephemeralPublicKey,
                      maxEpoch,
                      getZkProof,
                    },
                  );
                  log.debug("zkSignature ready", {
                    length: zkSignature.length,
                  });
                  log.debug("Transaction block bytes ready", {
                    length: bytes.length,
                  });

                  const txDigest = await suiClient.executeTransactionBlock({
                    transactionBlock: bytes,
                    signature: zkSignature,
                  });

                  log.info("Transaction executed", {
                    digest: txDigest.digest,
                  });
                  setTxDigest(txDigest.digest);
                }}
              >
                Sign and submit tx Wallet Screen
              </Button>
            </div>
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
          <TokenListSection
            user={user}
            chain={chain || null}
            onAddToken={() => navigate({ to: "/wallet/add-token" })}
          />
        </main>
        <footer className="app-shell__footer" />
      </div>
    </Background>
  );
};
