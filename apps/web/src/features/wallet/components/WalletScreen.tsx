import {
  HeaderMobile,
  LockScreen,
  NetworkSelector,
  type TenantId,
} from "@evevault/shared";
import {
  handleTestTokenRefresh,
  switchTenantAndReload,
  useAuth,
} from "@evevault/shared/auth";
import {
  Background,
  Button,
  Heading,
  TenantSelector,
  Text,
  TokenListSection,
} from "@evevault/shared/components";
import Icon from "@evevault/shared/components/Icon";
import {
  useDevice,
  useEpochExpiration,
  useTenant,
} from "@evevault/shared/hooks";
import {
  getAvailableTenantIds,
  getCurrentTenantId,
  getTenantLabel,
  useDeviceStore,
  useNetworkStore,
} from "@evevault/shared/stores";
import { createSuiClient, getFaucetUrlForChain } from "@evevault/shared/sui";
import {
  createLogger,
  getSuiscanUrl,
  WEB_ROUTES,
} from "@evevault/shared/utils";
import { zkSignAny } from "@evevault/shared/wallet";
import { Transaction } from "@mysten/sui/transactions";
import { SUI_TESTNET_CHAIN } from "@mysten/wallet-standard";
import { useNavigate } from "@tanstack/react-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";

const log = createLogger();

export const WalletScreen = () => {
  const navigate = useNavigate();
  const [initError, setInitError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [txDigest, setTxDigest] = useState<string | null>(null);
  const { devMode, setDevMode } = useTenant();

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
  const availableTenantIds = useMemo(
    () => getAvailableTenantIds(devMode),
    [devMode],
  );
  const tenantId = getCurrentTenantId();

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

  const handleDevModeToggle = useCallback(() => {
    setDevMode(!devMode);
  }, [devMode, setDevMode]);

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
        onResetComplete={() => {
          window.location.href = "/";
        }}
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
        <TenantSelector currentTenantId={tenantId} viewOnly={true} />
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
        currentTenantId={devMode ? tenantId : undefined}
        onServerChange={(tenantId: TenantId) => switchTenantAndReload(tenantId)}
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
        <div className="flex justify-between items-center gap-2 w-full">
          <NetworkSelector
            chain={chain || SUI_TESTNET_CHAIN}
            onNetworkSwitchStart={(previousNetwork, targetNetwork) => {
              log.info("Network switch started", {
                previousNetwork,
                targetNetwork,
              });
            }}
          />
          <div className="dropdown-selector--inline">
            <div
              className="dropdown-selector__trigger"
              style={{ cursor: "default" }}
            >
              <Icon name="Network" color="quantum" />
              <Text variant="label-medium" size="medium">
                {getTenantLabel(tenantId)}
              </Text>
            </div>
          </div>
        </div>
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
