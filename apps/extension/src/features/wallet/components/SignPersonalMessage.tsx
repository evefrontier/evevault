import { useAuth } from "@evevault/shared/auth";
import {
  Button,
  CurrentNetworkDisplay,
  Heading,
  Text,
} from "@evevault/shared/components";
import { useDevice } from "@evevault/shared/hooks/useDevice";
import type { PendingPersonalMessage } from "@evevault/shared/types";
import { createLogger } from "@evevault/shared/utils";
import { zkSignAny } from "@evevault/shared/wallet";
import { useEffect, useState } from "react";

const log = createLogger();

function SignPersonalMessage() {
  const [pendingMessage, setPendingMessage] =
    useState<PendingPersonalMessage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { maxEpoch, getZkProof, ephemeralPublicKey } = useDevice();
  const { user } = useAuth();

  useEffect(() => {
    // Retrieve the pending transaction from storage
    chrome.storage.local.get("pendingAction").then((data) => {
      const pending = data.pendingAction;
      if (pending) {
        setPendingMessage(pending);
      } else {
        setError("No pending message found");
      }
    });
  }, []);

  const handleSignPersonalMessage = async () => {
    if (!pendingMessage) {
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

      const { message, windowId } = pendingMessage;

      if (!user) {
        throw new Error("User not found");
      }

      if (!ephemeralPublicKey) {
        throw new Error("Ephemeral public key not found");
      }

      if (!maxEpoch) {
        throw new Error("Max epoch is not set");
      }

      log.debug("Signing personal message", { length: message.length });

      const { zkSignature, bytes } = await zkSignAny(
        "PersonalMessage",
        new TextEncoder().encode(message) as Uint8Array,
        {
          user,
          ephemeralPublicKey,
          maxEpoch,
          getZkProof,
        },
      );

      // Store the result in storage so the background handler can pick it up
      await chrome.storage.local.set({
        transactionResult: {
          windowId,
          status: "signed",
          bytes,
          signature: zkSignature,
        },
      });

      log.debug("Signed personal message");

      // Close the popup window
      window.close();
    } catch (err) {
      log.error("Transaction signing failed", err);
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);

      // Store error result
      if (pendingMessage?.windowId) {
        await chrome.storage.local.set({
          transactionResult: {
            windowId: pendingMessage.windowId,
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
    if (!pendingMessage) return;

    try {
      // Store rejection result
      await chrome.storage.local.set({
        transactionResult: {
          windowId: pendingMessage.windowId,
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

  if (!pendingMessage) {
    return (
      <div style={{ padding: "20px" }}>
        <Text>Loading message...</Text>
        {error && <Text color="error">Error: {error}</Text>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-between h-4/5">
      <div className="flex flex-col items-center justify-center gap-10">
        <img src="/images/logo.png" alt="EVE Vault" className="h-20 " />
        <div className="flex flex-col items-center justify-center gap-4">
          <Heading level={2}>Sign Personal Message</Heading>
          {/* Transform message from obj to array, then stringify */}
          <Text>{JSON.stringify(Object.values(pendingMessage.message))}</Text>
        </div>

        {error && (
          <div style={{ marginBottom: "20px" }}>
            <Text color="error">Error: {error}</Text>
          </div>
        )}

        <div style={{ display: "flex", gap: "10px" }}>
          <Button
            onClick={handleSignPersonalMessage}
            disabled={loading}
            variant="primary"
          >
            {loading ? "Signing..." : "Approve"}
          </Button>

          <Button onClick={handleReject} disabled={loading} variant="secondary">
            Reject
          </Button>
        </div>
      </div>
      <CurrentNetworkDisplay
        className="justify-start w-full items-end"
        chain={pendingMessage.chain || "devnet"}
      />
    </div>
  );
}

export default SignPersonalMessage;
