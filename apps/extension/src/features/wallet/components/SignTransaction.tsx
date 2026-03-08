import {
  Button,
  Heading,
  NetworkSelector,
  Text,
} from "@evevault/shared/components";
import Json from "@evevault/shared/components/Json";
import { createSuiClient } from "@evevault/shared/sui";
import type { PendingTransaction } from "@evevault/shared/types";
import { buildTx, createLogger } from "@evevault/shared/utils";
import { zkSignAny } from "@evevault/shared/wallet";
import { Transaction, type TransactionData } from "@mysten/sui/transactions";
import { useEffect, useState } from "react";
import { useSignPopupAuth } from "../hooks";
import { SignPopupAuthGate } from "./SignPopupAuthGate";

const log = createLogger();

function SignTransaction() {
  const [pendingTransaction, setPendingTransaction] =
    useState<PendingTransaction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const auth = useSignPopupAuth();

  useEffect(() => {
    // Retrieve the pending transaction from storage
    chrome.storage.local.get("pendingAction").then((data) => {
      const pending = data.pendingAction;
      if (pending) {
        // When pending.transaction is present,
        // pending is a valid PendingTransaction.
        if (!pending.transaction) {
          setError("No transaction found");
          return;
        }

        setPendingTransaction(pending as PendingTransaction);
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
      const suiClient = createSuiClient(chain);

      // Convert the transaction bytes to a Transaction object
      // And set the sender to the user's address
      const txb = await buildTx(
        Transaction.from(transaction as string),
        auth.user,
        suiClient,
      );

      if (!auth.ephemeralPublicKey) {
        throw new Error("Ephemeral public key not found");
      }

      if (!auth.maxEpoch) {
        throw new Error("Max epoch is not set");
      }

      // Sign the transaction using your zkSignAny function
      const { zkSignature, bytes } = await zkSignAny("TransactionData", txb, {
        user: auth.user,
        ephemeralPublicKey: auth.ephemeralPublicKey,
        maxEpoch: auth.maxEpoch,
        getZkProof: auth.getZkProof,
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

  return (
    <SignPopupAuthGate
      isLocked={auth.isLocked}
      isPinSet={auth.isPinSet}
      unlock={auth.unlock}
      user={auth.user}
      loading={auth.loading}
      login={auth.login}
      title="Sign Transaction"
      onCancel={handleReject}
      cancelDisabled={auth.loading || !pendingTransaction}
    >
      {!pendingTransaction ? (
        <div>
          <p>Loading transaction...</p>
          {error && <p style={{ color: "red" }}>Error: {error}</p>}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-between h-full">
          <div className="flex flex-col items-center justify-center gap-10">
            <img src="/images/logo.png" alt="EVE Vault" className="h-20 " />
            <div className="flex flex-col items-center justify-center gap-4">
              <Heading level={2}>Sign Transaction</Heading>
              <Json
                value={JSON.stringify(
                  JSON.parse(
                    pendingTransaction.transaction as string,
                  ) as TransactionData,
                )}
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

export default SignTransaction;
