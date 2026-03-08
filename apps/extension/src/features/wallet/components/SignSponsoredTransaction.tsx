import {
  Button,
  Heading,
  NetworkSelector,
  Text,
} from "@evevault/shared/components";
import { createLogger } from "@evevault/shared/utils";
import { zkSignAny } from "@evevault/shared/wallet";
import { useEffect, useState } from "react";
import { useSignPopupAuth } from "../hooks";
import { SignPopupAuthGate } from "./SignPopupAuthGate";

const log = createLogger();

export type PendingSponsoredAction = {
  action: string;
  id?: string;
  senderTabId?: number;
  timestamp: number;
  windowId: number;
  sponsoredTxB64: string;
  preparationId: string;
  chain: string;
};

function SignSponsoredTransaction() {
  const [pending, setPending] = useState<PendingSponsoredAction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const auth = useSignPopupAuth();

  useEffect(() => {
    chrome.storage.local.get("pendingAction").then((data) => {
      const action = data.pendingAction;
      if (action?.sponsoredTxB64 != null && action?.preparationId != null) {
        setPending(action as PendingSponsoredAction);
      } else {
        setError("No pending sponsored transaction found");
      }
    });
  }, []);

  const handleApprove = async () => {
    if (!pending) return;
    if (!auth.user) {
      setError("Sign in and try again.");
      return;
    }
    if (!auth.ephemeralPublicKey) {
      setError("Device key not found. Unlock the wallet and try again.");
      return;
    }
    if (!auth.maxEpoch) {
      setError("Max epoch not set. Re-authenticate and try again.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const txbBytes = Uint8Array.from(atob(pending.sponsoredTxB64), (c) =>
        c.charCodeAt(0),
      );
      const { zkSignature } = await zkSignAny("TransactionData", txbBytes, {
        user: auth.user,
        ephemeralPublicKey: auth.ephemeralPublicKey,
        maxEpoch: auth.maxEpoch,
        getZkProof: auth.getZkProof,
      });

      await chrome.storage.local.set({
        transactionResult: {
          windowId: pending.windowId,
          status: "signed",
          zkSignature,
          preparationId: pending.preparationId,
        },
      });
      window.close();
    } catch (err) {
      log.error("Sponsored transaction signing failed", err);
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      await chrome.storage.local.set({
        transactionResult: {
          windowId: pending.windowId,
          status: "error",
          error: errorMessage,
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!pending) return;
    try {
      await chrome.storage.local.set({
        transactionResult: {
          windowId: pending.windowId,
          status: "error",
          error: "Transaction rejected by user",
        },
      });
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
      title="Approve sponsored transaction"
      onCancel={handleReject}
      cancelDisabled={auth.loading || !pending}
    >
      {!pending ? (
        <div>
          <p>Loading...</p>
          {error && <p style={{ color: "red" }}>{error}</p>}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-between h-full">
          <div className="flex flex-col items-center justify-center gap-10">
            <img src="/images/logo.png" alt="EVE Vault" className="h-20" />
            <div className="flex flex-col items-center justify-center gap-4">
              <Heading level={2}>Approve sponsored transaction</Heading>
              <Text>Sign this sponsored transaction to continue.</Text>
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
            chain={pending.chain}
          />
        </div>
      )}
    </SignPopupAuthGate>
  );
}

export default SignSponsoredTransaction;
