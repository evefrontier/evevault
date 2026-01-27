import { HeaderMobile, LockScreen, NetworkSelector } from "@evevault/shared";
import { useAuth } from "@evevault/shared/auth";
import {
  Background,
  Button,
  Heading,
  Text,
  TokenListSection,
} from "@evevault/shared/components";
import { useDevice, useEpochExpiration } from "@evevault/shared/hooks";
import { useDeviceStore } from "@evevault/shared/stores/deviceStore";
import { useNetworkStore } from "@evevault/shared/stores/networkStore";
import { createSuiClient } from "@evevault/shared/sui";
import {
  createLogger,
  getSuiscanUrl,
  WEB_ROUTES,
} from "@evevault/shared/utils";
import { zkSignAny } from "@evevault/shared/wallet";
import { Transaction } from "@mysten/sui/transactions";
import type { SuiChain } from "@mysten/wallet-standard";
import { SUI_DEVNET_CHAIN } from "@mysten/wallet-standard";
import { useNavigate } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";

const log = createLogger();

export const WalletScreen = () => {
  const navigate = useNavigate();
  const [initError, setInitError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [txDigest, setTxDigest] = useState<string | null>(null);
  const [_previousNetworkBeforeSwitch, setPreviousNetworkBeforeSwitch] =
    useState<SuiChain | null>(null);

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
    maxEpoch,
    ephemeralPublicKey,
    getZkProof,
    error: deviceError,
    loading: deviceLoading,
    unlock,
  } = useDevice();
  const { chain } = useNetworkStore();

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
      {/* Token Section */}
      <TokenListSection
        user={user}
        chain={chain || null}
        walletAddress={user?.profile?.sui_address as string}
        onAddToken={() => navigate({ to: WEB_ROUTES.WALLET_ADD_TOKEN })}
        onSendToken={(coinType) =>
          navigate({
            to: WEB_ROUTES.WALLET_SEND_TOKEN,
            search: { coinType },
          })
        }
      />
      {/* Network display and Test transaction button */}
      <div className="justify-between pt-8 flex gap-4 flex-col sm:flex-row">
        <NetworkSelector
          chain={chain || SUI_DEVNET_CHAIN}
          onNetworkSwitchStart={(previousNetwork, targetNetwork) => {
            log.info("Network switch started", {
              previousNetwork,
              targetNetwork,
            });
            setPreviousNetworkBeforeSwitch(previousNetwork as SuiChain);
          }}
        />
        <div>
          <div className="flex align-items-end flex-col items-center gap-2">
            <Button
              size="small"
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
            <Button
              variant="secondary"
              size="small"
              onClick={() => navigate({ to: WEB_ROUTES.WALLET_TRANSACTIONS })}
            >
              View Transaction History
            </Button>
          </div>
          {txDigest && (
            <div>
              <Text>
                Tx digest:{" "}
                <a
                  href={chain ? getSuiscanUrl(chain, txDigest) : "#"}
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
        </div>
      </div>
    </div>
  );
};
