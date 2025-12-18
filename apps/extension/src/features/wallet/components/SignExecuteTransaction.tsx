import { useAuth } from "@evevault/shared/auth";
import { Button, Heading, Text } from "@evevault/shared/components";
import { useDevice } from "@evevault/shared/hooks/useDevice";
import { createSuiClient } from "@evevault/shared/sui";
import type { PendingTransaction } from "@evevault/shared/types";
import { buildTx, createLogger } from "@evevault/shared/utils";
import { zkSignAny } from "@evevault/shared/wallet";
import { Transaction } from "@mysten/sui/transactions";
import { useEffect, useState } from "react";

const log = createLogger();

function SignAndExecuteTransaction() {
  const [pendingTransaction, setPendingTransaction] =
    useState<PendingTransaction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { maxEpoch, getZkProof, ephemeralPublicKey } = useDevice();
  const { user } = useAuth();

  useEffect(() => {
    // Retrieve the pending transaction from storage
    chrome.storage.local.get("pendingTransaction").then((data) => {
      const pending = data.pendingTransaction;
      if (pending) {
        setPendingTransaction(pending);
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
    if (!user) {
      log.error("No user found");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { transaction, chain, windowId } = pendingTransaction;

      // Create SuiClient for the specified chain
      const suiClient = createSuiClient(chain);

      const txb = await buildTx(
        Transaction.from(transaction as string),
        user,
        suiClient,
      );

      if (!ephemeralPublicKey) {
        throw new Error("Ephemeral public key not found");
      }

      if (!maxEpoch) {
        throw new Error("Max epoch is not set");
      }

      // Sign the transaction using the zkSignAny function
      const { zkSignature, bytes } = await zkSignAny("TransactionData", txb, {
        user,
        ephemeralPublicKey,
        maxEpoch,
        getZkProof,
      });

      // Store the result in storage so the background handler can pick it up
      await chrome.storage.local.set({
        transactionResult: {
          windowId,
          status: "signed",
          bytes,
          signature: zkSignature,
        },
      });

      // Close the popup window
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

  if (!pendingTransaction) {
    return (
      <div style={{ padding: "20px" }}>
        <Text>Loading transaction...</Text>
        {error && <Text color="error">Error: {error}</Text>}
      </div>
    );
  }

  return (
    <div style={{ padding: "20px" }}>
      <Heading level={2}>Approve Transaction</Heading>

      <div style={{ marginBottom: "20px" }}>
        <Text>
          <strong>Chain:</strong> {pendingTransaction.chain || "devnet"}
        </Text>
        <Text>
          <strong>Account:</strong>{" "}
          {pendingTransaction.account?.address || "Unknown"}
        </Text>
      </div>

      {error && (
        <div style={{ marginBottom: "20px" }}>
          <Text color="error">Error: {error}</Text>
        </div>
      )}

      <div className="flex gap-2 w-full">
        <Button onClick={handleApprove} disabled={loading} variant="primary">
          {loading ? "Signing..." : "Approve"}
        </Button>

        <Button onClick={handleReject} disabled={loading} variant="secondary">
          Reject
        </Button>
      </div>
    </div>
  );
}

export default SignAndExecuteTransaction;
