import { isLocalnetChain } from "@evevault/shared";
import {
  Button,
  Heading,
  NetworkSelector,
  Text,
} from "@evevault/shared/components";
import Json from "@evevault/shared/components/Json";
import { useNetwork } from "@evevault/shared/hooks/useNetwork";
import { useNetworkStore } from "@evevault/shared/stores";
import { createSuiClient } from "@evevault/shared/sui";
import type { ParsedTransactionWithDisplay } from "@evevault/shared/types";
import {
  buildTx,
  createLogger,
  parseTransactionBytes,
} from "@evevault/shared/utils";
import { signForChain, useLocalnetAddress } from "@evevault/shared/wallet";
import { Transaction } from "@mysten/sui/transactions";
import { toBase64 } from "@mysten/sui/utils";
import type { SuiChain } from "@mysten/wallet-standard";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useSignPopupAuth } from "@/features/wallet/hooks";
import { SignPopupAuthGate } from "./SignPopupAuthGate";

const log = createLogger();

function SignAndExecuteTransaction() {
  const { chain } = useNetwork();
  const isLocalnet = isLocalnetChain(chain);
  const localnetAddress = useLocalnetAddress();
  const { localnetUrl } = useNetworkStore();
  const [pendingTransaction, setPendingTransaction] =
    useState<ParsedTransactionWithDisplay | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const auth = useSignPopupAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Retrieve the pending transaction from storage
    chrome.storage.local.get("pendingAction").then(async (data) => {
      const pending = data.pendingAction;

      console.log(data);

      if (pending) {
        // When pending.transaction is present,
        // pending is a valid PendingTransaction.
        if (!pending.transaction) {
          setError("No transaction found");
          return;
        }

        const parsedTx = await parseTransactionBytes(pending.transaction);

        setPendingTransaction({
          ...pending,
          transaction:
            parsedTx.transactionForSigning != null
              ? parsedTx.transactionForSigning
              : pending.transaction,
          displayValue: parsedTx.displayValue,
        });
      } else {
        setError("No pending transaction found");
      }
    });
  }, []);

  const handleApprove = async () => {
    if (!pendingTransaction) {
      log.error("No pending transaction found");
      return;
    }
    if (!auth.user) {
      log.error("No user found");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { transaction, chain, windowId } = pendingTransaction;

      // Create SuiClient for the specified chain
      // Explicitly pass localnetUrl if isLocalnet
      const suiClient = createSuiClient(
        chain,
        isLocalnet ? localnetUrl : undefined,
      );

      // Convert the transaction bytes to a Transaction object
      // And set the sender to the user's address
      const txb = await buildTx(
        Transaction.from(transaction as string),
        isLocalnet
          ? (localnetAddress ?? "")
          : (auth.user.profile.sui_address as string),
        suiClient,
      );

      if (!isLocalnet) {
        if (!auth.ephemeralPublicKey) {
          throw new Error("Ephemeral public key not found");
        }
        if (!auth.maxEpoch) {
          throw new Error("Max epoch is not set");
        }
      }

      const { bytes, signature } = await signForChain("TransactionData", txb, {
        chain: chain as SuiChain,
        user: auth.user,
        getZkProof: isLocalnet ? null : auth.getZkProof,
        localnetAddress,
      });

      // Execute the transaction
      const execResult = await suiClient.executeTransaction({
        transaction: txb,
        signatures: [signature],
        include: { effects: true },
      });

      if (execResult.$kind === "FailedTransaction") {
        const failedTx = execResult.FailedTransaction;
        const errorMessage =
          failedTx?.status &&
          typeof failedTx.status === "object" &&
          "error" in failedTx.status
            ? String(
                (failedTx.status as { error?: { message?: string } }).error
                  ?.message ?? "Transaction failed",
              )
            : "Transaction failed";
        throw new Error(errorMessage);
      }

      if (
        !execResult.Transaction?.digest ||
        execResult.Transaction.effects?.bcs == null
      ) {
        throw new Error(
          "Transaction execution result is missing digest or effects",
        );
      }

      const digest = execResult.Transaction?.digest;
      const effects = toBase64(execResult.Transaction.effects.bcs);

      // Store the result in storage so the background handler can pick it up
      await chrome.storage.local.set({
        transactionResult: {
          windowId,
          status: "signed_and_executed",
          bytes,
          signature,
          digest,
          effects,
        },
      });

      // Invalidate so next time the popup opens it refetches; don't await so close isn't delayed
      queryClient.invalidateQueries({ queryKey: ["coin-balance"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });

      window.close();
    } catch (err) {
      log.error("Transaction signing failed", err);
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);

      // Store error result
      if (pendingTransaction?.windowId) {
        await chrome.storage.local.set({
          transactionResult: {
            windowId: pendingTransaction.windowId,
            status: "error",
            error: errorMessage,
          },
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!pendingTransaction) return;

    try {
      // Store rejection result
      await chrome.storage.local.set({
        transactionResult: {
          windowId: pendingTransaction.windowId,
          status: "error",
          error: "Transaction rejected by user",
        },
      });

      // Close the popup window
      window.close();
    } catch (err) {
      log.error("Failed to reject transaction", err);
      setError("Failed to reject transaction");
    }
  };

  return (
    <SignPopupAuthGate
      isLocked={auth.isLocked}
      isPinSet={auth.isPinSet}
      unlock={auth.unlock}
      user={auth.user}
      loading={auth.loading}
      login={auth.login}
      title="Sign and Execute Transaction"
      onCancel={handleReject}
      cancelDisabled={auth.loading || !pendingTransaction}
    >
      {!pendingTransaction ? (
        <div style={{ padding: "20px" }}>
          <Text>Loading transaction...</Text>
          {error && <Text color="error">Error: {error}</Text>}
        </div>
      ) : (
        <div style={{ padding: "20px" }}>
          <div className="flex flex-col items-center justify-center gap-10">
            <img src="/images/logo.png" alt="EVE Vault" className="h-20 " />
            <div className="flex flex-col items-center justify-center gap-4">
              <Heading level={2}>Sign and Execute Transaction</Heading>
              <Json
                value={pendingTransaction.displayValue}
                className={"max-h-24"}
              />
            </div>

            {error && (
              <div style={{ marginBottom: "20px" }}>
                <Text color="error">Error: {error}</Text>
              </div>
            )}

            <div style={{ display: "flex", gap: "10px" }}>
              <Button
                onClick={handleApprove}
                disabled={loading}
                variant="primary"
              >
                {loading ? "Signing..." : "Approve"}
              </Button>

              <Button
                onClick={handleReject}
                disabled={loading}
                variant="secondary"
              >
                Reject
              </Button>
            </div>
          </div>
          <NetworkSelector
            className="justify-start w-full items-end"
            chain={pendingTransaction.chain}
          />
        </div>
      )}
    </SignPopupAuthGate>
  );
}

export default SignAndExecuteTransaction;
