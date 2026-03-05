import { useAuth } from "@evevault/shared/auth";
import {
  Button,
  Heading,
  NetworkSelector,
  Text,
} from "@evevault/shared/components";
import { useDevice } from "@evevault/shared/hooks/useDevice";
import { useNetwork } from "@evevault/shared/hooks/useNetwork";
import { LockScreen } from "@evevault/shared/screens";
import type { PendingPersonalMessage } from "@evevault/shared/types";
import { createLogger } from "@evevault/shared/utils";
import { zkSignAny } from "@evevault/shared/wallet";
import { SUI_TESTNET_CHAIN } from "@mysten/wallet-standard";
import { useEffect, useState } from "react";

const log = createLogger();

/**
 * Converts the message field from a PendingPersonalMessage into a Uint8Array.
 * The message may arrive as a Uint8Array, a plain object with numeric keys
 * (after chrome.storage serialization), or a number array.
 */
function toMessageBytes(
  message: Uint8Array | Record<string, number> | number[],
): Uint8Array {
  if (message instanceof Uint8Array) {
    return message;
  }
  if (Array.isArray(message)) {
    return new Uint8Array(message);
  }
  return new Uint8Array(Object.values(message));
}

/**
 * Decodes message bytes to a human-readable string.
 * Falls back to showing the raw byte count if decoding fails.
 */
function decodeMessageBytes(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (err) {
    log.warn("Failed to decode message bytes as UTF-8, falling back to byte count", err);
    return `[binary message, ${bytes.length} bytes]`;
  }
}

function SignPersonalMessage() {
  const { chain } = useNetwork();
  const [pendingMessage, setPendingMessage] =
    useState<PendingPersonalMessage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { maxEpoch, getZkProof, ephemeralPublicKey, isLocked, isPinSet, unlock } = useDevice();
  const { user, loading: authLoading, login, initialize: initializeAuth } = useAuth();

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

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

      if (!ephemeralPublicKey) {
        throw new Error("Ephemeral public key not found");
      }

      if (!maxEpoch) {
        throw new Error("Max epoch is not set");
      }

      // Convert message (may be Uint8Array, object with numeric keys, or array)
      // to a proper Uint8Array for signing
      const messageBytes = toMessageBytes(message);

      log.debug("Signing personal message", { length: messageBytes.length });

      const { zkSignature, bytes } = await zkSignAny(
        "PersonalMessage",
        messageBytes,
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

  // Show lock screen if vault is locked
  if (isLocked) {
    return <LockScreen isPinSet={isPinSet} unlock={unlock} />;
  }

  // Show login prompt if user is not authenticated
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 h-full">
        <img src="/images/logo.png" alt="EVE Vault" className="h-20" />
        <Heading level={2}>Sign Personal Message</Heading>
        <Text variant="light">You need to log in before signing.</Text>
        <Button
          onClick={() => login()}
          disabled={authLoading}
          variant="primary"
          size="fill"
        >
          {authLoading ? "Logging in..." : "Log In to Sign"}
        </Button>
        <Button onClick={handleReject} disabled={authLoading || !pendingMessage} variant="secondary">
          Cancel
        </Button>
      </div>
    );
  }

  if (!pendingMessage) {
    return (
      <div style={{ padding: "20px" }}>
        <Text>Loading message...</Text>
        {error && <Text color="error">Error: {error}</Text>}
      </div>
    );
  }

  const messageBytes = toMessageBytes(pendingMessage.message);
  const displayText = decodeMessageBytes(messageBytes);

  return (
    <div className="flex flex-col items-center justify-between h-4/5">
      <div className="flex flex-col items-center justify-center gap-10">
        <img src="/images/logo.png" alt="EVE Vault" className="h-20 " />
        <div className="flex flex-col items-center justify-center gap-4">
          <Heading level={2}>Sign Personal Message</Heading>
          <Text>{displayText}</Text>
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
      <NetworkSelector
        className="justify-start w-full items-end"
        chain={chain || SUI_TESTNET_CHAIN}
      />
    </div>
  );
}

export default SignPersonalMessage;
