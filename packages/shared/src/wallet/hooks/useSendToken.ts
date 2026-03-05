import { Transaction } from "@mysten/sui/transactions";
import { isValidSuiAddress } from "@mysten/sui/utils";
import { useCallback, useMemo, useState } from "react";
import { getUserForNetwork, useAuth } from "../../auth";
import { useDevice } from "../../hooks";
import { useNetworkStore } from "../../stores/networkStore";
import { createSuiClient } from "../../sui";
import {
  createLogger,
  EVE_TESTNET_COIN_TYPE,
  SUI_COIN_TYPE,
  toSmallestUnit,
} from "../../utils";
import { zkSignAny } from "../zkSignAny";
import { useBalance } from "./useBalance";

const log = createLogger();

interface UseSendTokenParams {
  coinType: string;
  recipientAddress: string;
  amount: string;
}

interface UseSendTokenResult {
  // Validation state
  isNetworkReady: boolean;
  isAuthenticated: boolean;
  isWalletUnlocked: boolean;
  hasBalance: boolean;
  isValidRecipient: boolean;
  isValidAmount: boolean;
  canSend: boolean;
  validationErrors: string[];

  // Balance info
  currentBalance: string;
  tokenSymbol: string;
  tokenName: string;
  decimals: number;

  // Execution
  send: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
  txDigest: string | null;
}

/**
 * Hook for sending tokens with validation and transaction execution
 */
export function useSendToken({
  coinType,
  recipientAddress,
  amount,
}: UseSendTokenParams): UseSendTokenResult {
  const { user: globalUser } = useAuth();
  const { ephemeralPublicKey, getZkProof, maxEpoch, isLocked } = useDevice();
  const { chain } = useNetworkStore();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txDigest, setTxDigest] = useState<string | null>(null);

  const suiClient = useMemo(() => createSuiClient(chain), [chain]);

  // Fetch balance for the selected token
  const { data: balanceData, isLoading: balanceLoading } = useBalance({
    user: globalUser,
    chain,
    coinType,
  });

  // Extract balance info
  const currentBalance = balanceData?.formattedBalance ?? "0";
  const rawBalance = balanceData?.rawBalance ?? "0";
  const tokenSymbol =
    balanceData?.metadata?.symbol ??
    (coinType === EVE_TESTNET_COIN_TYPE ? "EVE" : "");
  const tokenName =
    balanceData?.metadata?.name ??
    (coinType === EVE_TESTNET_COIN_TYPE ? "EVE test token" : "Token");
  const decimals = balanceData?.metadata?.decimals ?? 9;

  // Validation checks
  const isNetworkReady = !!chain;
  const isAuthenticated = !!globalUser;
  const isWalletUnlocked = !isLocked && !!ephemeralPublicKey && !!maxEpoch;
  const hasBalance = !balanceLoading && BigInt(rawBalance) > 0n;
  const isValidRecipient =
    recipientAddress.length > 0 && isValidSuiAddress(recipientAddress);

  // Amount validation
  const isValidAmount = useMemo(() => {
    if (!amount || amount === "" || amount === "0") return false;

    try {
      const amountInSmallestUnit = toSmallestUnit(amount, decimals);
      const balanceInSmallestUnit = BigInt(rawBalance);

      return (
        amountInSmallestUnit > 0n &&
        amountInSmallestUnit <= balanceInSmallestUnit
      );
    } catch {
      return false;
    }
  }, [amount, rawBalance, decimals]);

  // Collect validation errors
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!isNetworkReady) errors.push("No network selected");
    if (!isAuthenticated) errors.push("Not authenticated");
    if (!isWalletUnlocked) errors.push("Wallet is locked");
    if (!hasBalance) errors.push("Insufficient balance");
    if (recipientAddress && !isValidRecipient)
      errors.push("Invalid Sui address");
    if (amount && !isValidAmount) errors.push("Invalid amount");
    return errors;
  }, [
    isNetworkReady,
    isAuthenticated,
    isWalletUnlocked,
    hasBalance,
    isValidRecipient,
    isValidAmount,
    recipientAddress,
    amount,
  ]);

  const canSend =
    isNetworkReady &&
    isAuthenticated &&
    isWalletUnlocked &&
    hasBalance &&
    isValidRecipient &&
    isValidAmount;

  const send = useCallback(async () => {
    if (!canSend) {
      setError("Cannot send: validation failed");
      return;
    }

    setIsLoading(true);
    setError(null);
    setTxDigest(null);

    try {
      // Get user for current network
      const user = await getUserForNetwork(chain);
      if (!user) {
        throw new Error("User not found for current network");
      }

      if (!ephemeralPublicKey) {
        throw new Error("Ephemeral public key not found");
      }

      if (!maxEpoch) {
        throw new Error("Max epoch not set");
      }

      const senderAddress = user.profile?.sui_address as string;
      const amountInSmallestUnit = toSmallestUnit(amount, decimals);

      const tx = new Transaction();
      tx.setSender(senderAddress);

      if (coinType === SUI_COIN_TYPE) {
        // Native SUI transfer: split from gas coin
        const [coin] = tx.splitCoins(tx.gas, [amountInSmallestUnit]);
        tx.transferObjects([coin], recipientAddress);
      } else {
        // Custom token transfer: get all coins and find one with sufficient balance.
        // @mysten/sui 2.x: getCoins on client with { owner, coinType }. Typed via core for compatibility.
        type CoinWithBalance = { balance: string; id: string };
        const coins = await (
          suiClient as unknown as {
            getCoins(opts: {
              owner: string;
              coinType: string;
            }): Promise<{ objects: CoinWithBalance[] }>;
          }
        ).getCoins({ owner: senderAddress, coinType });
        const coinObjects = coins.objects;

        if (coinObjects.length === 0) {
          throw new Error("No coins found for this token");
        }

        // Race condition guard: validate total balance still covers the requested amount
        // (balance may have changed between initial validation and now)
        const totalBalance = coinObjects.reduce(
          (sum: bigint, coin: CoinWithBalance) => sum + BigInt(coin.balance),
          0n,
        );

        if (totalBalance < amountInSmallestUnit) {
          throw new Error(
            "Token balance changed during transaction preparation",
          );
        }

        // Find a coin with sufficient balance, or merge if needed
        const suitableCoin = coinObjects.find(
          (c: CoinWithBalance) => BigInt(c.balance) >= amountInSmallestUnit,
        );

        if (suitableCoin) {
          // Single coin has enough balance - split from it
          const [coin] = tx.splitCoins(tx.object(suitableCoin.id), [
            amountInSmallestUnit,
          ]);
          tx.transferObjects([coin], recipientAddress);
        } else {
          // No single coin has enough - merge all coins then split
          // Use the first coin as the primary and merge others into it
          const primaryCoin = coinObjects[0];
          const otherCoins = coinObjects.slice(1);

          if (otherCoins.length > 0) {
            tx.mergeCoins(
              tx.object(primaryCoin.id),
              otherCoins.map((c: CoinWithBalance) => tx.object(c.id)),
            );
          }

          const [coin] = tx.splitCoins(tx.object(primaryCoin.id), [
            amountInSmallestUnit,
          ]);
          tx.transferObjects([coin], recipientAddress);
        }
      }

      // Build transaction
      const txb = await tx.build({ client: suiClient });

      // Sign with zkLogin
      const { bytes, zkSignature } = await zkSignAny("TransactionData", txb, {
        user,
        ephemeralPublicKey,
        maxEpoch,
        getZkProof,
      });

      log.debug("Transaction signed", {
        bytesLength: bytes.length,
        signatureLength: zkSignature.length,
      });

      // Execute transaction
      const result = await suiClient.core.executeTransaction({
        transaction: new Uint8Array(txb),
        signatures: [zkSignature],
      });

      // @mysten/sui 2.x: discriminated union Transaction | FailedTransaction
      if ("$kind" in result && result.$kind === "FailedTransaction") {
        throw new Error("Transaction failed");
      }
      const txResponse = (result as { Transaction: { digest?: string | null } })
        .Transaction;
      const digest = txResponse?.digest ?? null;

      log.info("Token transfer executed", {
        digest,
        coinType,
        amount,
        recipient: recipientAddress,
      });

      setTxDigest(digest);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to send token";
      log.error("Token transfer failed", err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [
    canSend,
    chain,
    coinType,
    amount,
    decimals,
    recipientAddress,
    ephemeralPublicKey,
    maxEpoch,
    getZkProof,
    suiClient,
  ]);

  return {
    // Validation state
    isNetworkReady,
    isAuthenticated,
    isWalletUnlocked,
    hasBalance,
    isValidRecipient,
    isValidAmount,
    canSend,
    validationErrors,

    // Balance info
    currentBalance,
    tokenSymbol,
    tokenName,
    decimals,

    // Execution
    send,
    isLoading,
    error,
    txDigest,
  };
}
