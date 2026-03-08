import { HeaderMobile, LockScreen, NetworkSelector } from "@evevault/shared";
import {
  handleTestTokenRefresh,
  redirectToFusionAuthLogout,
  useAuth,
} from "@evevault/shared/auth";
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
import { createSuiClient, getFaucetUrlForChain } from "@evevault/shared/sui";
import {
  createLogger,
  getDevModeEnabled,
  getSuiscanUrl,
  setDevModeEnabled,
  WEB_ROUTES,
} from "@evevault/shared/utils";
import { zkSignAny } from "@evevault/shared/wallet";
import { Transaction } from "@mysten/sui/transactions";
import type { SuiChain } from "@mysten/wallet-standard";
import { SUI_TESTNET_CHAIN } from "@mysten/wallet-standard";
import { useNavigate } from "@tanstack/react-router";
import React, { useCallback, useEffect, useState } from "react";

const log = createLogger();

export const WalletScreen = () => {
  const navigate = useNavigate();
  const [initError, setInitError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [txDigest, setTxDigest] = useState<string | null>(null);
  const [devMode, setDevMode] = useState(false);
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
    nonce,
    error: deviceError,
    loading: deviceLoading,
    unlock,
  } = useDevice();
  const { chain } = useNetworkStore();
  const faucetUrl = getFaucetUrlForChain(chain);

  // Create suiClient with useMemo to recreate when chain changes
  const suiClient = React.useMemo(() => {
    // Defined chain so balance/transactions always use the same network; avoids cross-network errors
    const currentChain = chain || SUI_TESTNET_CHAIN;
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

  useEffect(() => {
    getDevModeEnabled().then(setDevMode);
  }, []);

  const handleDevModeToggle = useCallback(async () => {
    const next = !devMode;
    setDevMode(next);
    await setDevModeEnabled(next);
  }, [devMode]);

  const handleLogin = async () => {
    try {
      await login();
      log.info("Login successful");
    } catch (err) {
      log.error("Login error", err);
    }
  };

  const handleSignAndSubmitTx = useCallback(async () => {
    if (!user || !maxEpoch) return;
    if (!ephemeralPublicKey) {
      throw new Error("[Wallet Screen] Ephemeral public key not found");
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
    log.debug("Transaction block bytes ready", { length: bytes.length });
    const result = await suiClient.core.executeTransaction({
      transaction: new Uint8Array(txb),
      signatures: [zkSignature],
    });
    // @mysten/sui 2.x: discriminated union Transaction | FailedTransaction
    if ("$kind" in result && result.$kind === "FailedTransaction") {
      log.error("Transaction execution failed", { result });
      setTxDigest(null);
      return;
    }
    const digest = result.Transaction?.digest ?? null;
    log.info("Transaction executed", { digest });
    setTxDigest(digest);
  }, [user, maxEpoch, ephemeralPublicKey, getZkProof, suiClient]);

  const handleTokenRefreshTest = useCallback(async () => {
    if (!user) return;
    if (!nonce) {
      log.error("[Wallet Screen] Cannot refresh token: nonce is missing");
      window.alert(
        "Cannot refresh authentication token because the device nonce is missing. Please log in again.",
      );
      return;
    }
    await handleTestTokenRefresh(user, nonce);
  }, [user, nonce]);

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
    return (
      <LockScreen
        isPinSet={isPinSet}
        unlock={unlock}
        onResetComplete={() => redirectToFusionAuthLogout()}
      />
    );
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
        onTransactionsClick={() =>
          navigate({ to: WEB_ROUTES.WALLET_TRANSACTIONS })
        }
        showDevActions={devMode}
        onDevModeToggle={handleDevModeToggle}
        onSignSubmitTxClick={devMode ? handleSignAndSubmitTx : undefined}
        onTokenRefreshTestClick={devMode ? handleTokenRefreshTest : undefined}
        onFaucetTestSuiClick={
          devMode && faucetUrl
            ? () => window.open(faucetUrl, "_blank", "noopener,noreferrer")
            : undefined
        }
      />
      {/* Token Section: pass defined chain (testnet fallback) so balance and token list use the same network and we avoid cross-network transfer/balance errors */}
      <TokenListSection
        user={user}
        chain={chain ?? SUI_TESTNET_CHAIN}
        walletAddress={user?.profile?.sui_address as string}
        onAddToken={() => navigate({ to: WEB_ROUTES.WALLET_ADD_TOKEN })}
        onSendToken={(coinType) =>
          navigate({
            to: WEB_ROUTES.WALLET_SEND_TOKEN,
            search: { coinType },
          })
        }
      />
      {/* Network selector and test tx result */}
      <div className="justify-between pt-8 flex gap-4 flex-col sm:flex-row">
        <NetworkSelector
          chain={chain || SUI_TESTNET_CHAIN}
          onNetworkSwitchStart={(previousNetwork, targetNetwork) => {
            log.info("Network switch started", {
              previousNetwork,
              targetNetwork,
            });
            setPreviousNetworkBeforeSwitch(previousNetwork as SuiChain);
          }}
        />
        <div>
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
