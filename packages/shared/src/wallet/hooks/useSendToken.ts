import type { SuiGrpcClient } from "@mysten/sui/grpc";
import { Transaction } from "@mysten/sui/transactions";
import { isValidSuiAddress } from "@mysten/sui/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getUserForNetwork, useAuth } from "../../auth";
import { useDevice } from "../../hooks";
import { useNetworkStore } from "../../stores/networkStore";
import { createSuiClient } from "../../sui";
import {
  createLogger,
  EVE_TESTNET_COIN_TYPE,
  formatMistToSui,
  GAS_FEE_WARNING_MESSAGE,
  SUI_COIN_TYPE,
  toSmallestUnit,
} from "../../utils";
import { zkSignAny } from "../zkSignAny";
import { useBalance } from "./useBalance";

const log = createLogger();

const ESTIMATE_DEBOUNCE_MS = 600;

type CoinWithBalance = { balance: string; objectId: string };

/**
 * Builds a transfer transaction and returns the BCS bytes (unsigned).
 * Used for both execution and gas estimation.
 */
async function buildTransferTransactionBytes(
  senderAddress: string,
  recipientAddress: string,
  amountInSmallestUnit: bigint,
  coinType: string,
  suiClient: SuiGrpcClient,
): Promise<Uint8Array> {
  const tx = new Transaction();
  tx.setSender(senderAddress);

  if (coinType === SUI_COIN_TYPE) {
    const [coin] = tx.splitCoins(tx.gas, [amountInSmallestUnit]);
    tx.transferObjects([coin], recipientAddress);
  } else {
    const { objects: coinObjects } = await suiClient.listCoins({
      owner: senderAddress,
      coinType,
    });
    if (coinObjects.length === 0) {
      throw new Error("No coins found for this token");
    }
    const totalBalance = coinObjects.reduce(
      (sum: bigint, coin: CoinWithBalance) => sum + BigInt(coin.balance),
      0n,
    );
    if (totalBalance < amountInSmallestUnit) {
      throw new Error("Token balance changed during transaction preparation");
    }
    const suitableCoin = coinObjects.find(
      (c: CoinWithBalance) => BigInt(c.balance) >= amountInSmallestUnit,
    );
    if (suitableCoin) {
      const [coin] = tx.splitCoins(tx.object(suitableCoin.objectId), [
        amountInSmallestUnit,
      ]);
      tx.transferObjects([coin], recipientAddress);
    } else {
      const primaryCoin = coinObjects[0];
      const otherCoins = coinObjects.slice(1);
      if (otherCoins.length > 0) {
        tx.mergeCoins(
          tx.object(primaryCoin.objectId),
          otherCoins.map((c: CoinWithBalance) => tx.object(c.objectId)),
        );
      }
      const [coin] = tx.splitCoins(tx.object(primaryCoin.objectId), [
        amountInSmallestUnit,
      ]);
      tx.transferObjects([coin], recipientAddress);
    }
  }

  const txb = await tx.build({ client: suiClient });
  return new Uint8Array(txb);
}

/** SDK simulateTransaction result shape: effects live under Transaction or FailedTransaction. */
type SimulateResult =
  | {
      $kind: "Transaction";
      Transaction: { effects?: { gasUsed?: GasUsedShape } };
    }
  | {
      $kind: "FailedTransaction";
      FailedTransaction: { effects?: { gasUsed?: GasUsedShape } };
    };
type GasUsedShape = {
  computationCost?: string;
  storageCost?: string;
  storageRebate?: string;
  nonRefundableStorageFee?: string;
};

/** Parse gas cost in MIST from simulation result (best-effort). Expects SDK result with include.effects. */
function parseGasUsedFromSimulation(result: unknown): string | null {
  try {
    const r = result as SimulateResult;
    const effects =
      r?.$kind === "Transaction"
        ? r.Transaction?.effects
        : r?.$kind === "FailedTransaction"
          ? r.FailedTransaction?.effects
          : undefined;
    const gasUsed = effects?.gasUsed;
    if (!gasUsed) return null;
    const computation = BigInt(gasUsed.computationCost ?? "0");
    const storage = BigInt(gasUsed.storageCost ?? "0");
    const rebate = BigInt(gasUsed.storageRebate ?? "0");
    const nonRefundable = BigInt(gasUsed.nonRefundableStorageFee ?? "0");
    const total = computation + storage - rebate + nonRefundable;
    return total > 0n ? total.toString() : null;
  } catch {
    return null;
  }
}

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

  /** Warning when sending a non-SUI token but wallet has no SUI for gas. Non-blocking. */
  suiForGasWarning: string | null;

  /** True when SUI balance is zero; show faucet iframe/link for testnet. */
  showFaucetTestSui: boolean;

  /** Static message: transfer incurs a network fee paid in SUI. */
  gasFeeWarning: string;

  /** Estimated fee in SUI from simulation, or null if unavailable. */
  estimatedGasFee: string | null;

  /** True while estimating gas (debounced simulation in progress). */
  estimatedGasFeeLoading: boolean;

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
  const [estimatedGasFee, setEstimatedGasFee] = useState<string | null>(null);
  const [estimatedGasFeeLoading, setEstimatedGasFeeLoading] = useState(false);
  const estimateRunIdRef = useRef(0);

  const suiClient = useMemo(() => createSuiClient(chain), [chain]);

  // Fetch balance for the selected token
  const { data: balanceData, isLoading: balanceLoading } = useBalance({
    user: globalUser,
    chain,
    coinType,
  });

  // Fetch SUI balance for gas warning and send eligibility (non-SUI transfers need SUI for gas)
  const { data: suiBalanceData, isLoading: suiBalanceLoading } = useBalance({
    user: globalUser,
    chain,
    coinType: SUI_COIN_TYPE,
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

  const rawSuiBalance = suiBalanceData?.rawBalance ?? "0";
  const hasZeroSui = !suiBalanceLoading && BigInt(rawSuiBalance) === 0n;
  const hasGas =
    coinType === SUI_COIN_TYPE || (suiBalanceLoading ? false : !hasZeroSui);

  // Collect validation errors
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!isNetworkReady) errors.push("No network selected");
    if (!isAuthenticated) errors.push("Not authenticated");
    if (!isWalletUnlocked) errors.push("Wallet is locked");
    if (!hasBalance) errors.push("Insufficient balance");
    if (!hasGas) errors.push("No SUI for gas (required for transaction fees)");
    if (recipientAddress && !isValidRecipient)
      errors.push("Invalid Sui address");
    if (amount && !isValidAmount) errors.push("Invalid amount");
    return errors;
  }, [
    isNetworkReady,
    isAuthenticated,
    isWalletUnlocked,
    hasBalance,
    hasGas,
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
    hasGas &&
    isValidRecipient &&
    isValidAmount;

  const suiForGasWarning =
    !suiBalanceLoading && coinType !== SUI_COIN_TYPE && hasZeroSui
      ? "You have no SUI balance. SUI is required to pay for transaction fees."
      : null;
  const showFaucetTestSui = !suiBalanceLoading && hasZeroSui;

  const formValidForEstimate =
    isValidRecipient &&
    isValidAmount &&
    hasBalance &&
    !balanceLoading &&
    !!globalUser?.profile?.sui_address &&
    !!chain;

  useEffect(() => {
    if (!formValidForEstimate || !suiClient) {
      setEstimatedGasFee(null);
      setEstimatedGasFeeLoading(false);
      return;
    }

    const runId = ++estimateRunIdRef.current;
    const timer = setTimeout(async () => {
      setEstimatedGasFeeLoading(true);
      setEstimatedGasFee(null);
      try {
        const user = await getUserForNetwork(chain);
        const senderAddress = user?.profile?.sui_address as string | undefined;
        if (!senderAddress) {
          if (runId === estimateRunIdRef.current) {
            setEstimatedGasFee(null);
          }
          return;
        }
        const amountInSmallestUnit = toSmallestUnit(amount, decimals);
        const txBytes = await buildTransferTransactionBytes(
          senderAddress,
          recipientAddress,
          amountInSmallestUnit,
          coinType,
          suiClient,
        );
        const sim = await suiClient.simulateTransaction({
          transaction: txBytes,
          include: { effects: true },
        });
        const mist = parseGasUsedFromSimulation(sim);
        if (runId === estimateRunIdRef.current && mist) {
          setEstimatedGasFee(formatMistToSui(mist));
        }
      } catch (err) {
        log.warn("Gas estimation failed", { err });
        if (runId === estimateRunIdRef.current) {
          setEstimatedGasFee(null);
        }
      } finally {
        if (runId === estimateRunIdRef.current) {
          setEstimatedGasFeeLoading(false);
        }
      }
    }, ESTIMATE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [
    formValidForEstimate,
    suiClient,
    chain,
    amount,
    decimals,
    recipientAddress,
    coinType,
  ]);

  const send = useCallback(async () => {
    if (!canSend) {
      setError("Cannot send: validation failed");
      return;
    }

    setIsLoading(true);
    setError(null);
    setTxDigest(null);

    try {
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

      const txBytes = await buildTransferTransactionBytes(
        senderAddress,
        recipientAddress,
        amountInSmallestUnit,
        coinType,
        suiClient,
      );

      const { bytes, zkSignature } = await zkSignAny(
        "TransactionData",
        txBytes,
        {
          user,
          ephemeralPublicKey,
          maxEpoch,
          getZkProof,
        },
      );

      log.debug("Transaction signed", {
        bytesLength: bytes.length,
        signatureLength: zkSignature.length,
      });

      const result = await suiClient.core.executeTransaction({
        transaction: txBytes,
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
    suiForGasWarning,
    showFaucetTestSui,
    gasFeeWarning: GAS_FEE_WARNING_MESSAGE,
    estimatedGasFee,
    estimatedGasFeeLoading,

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
