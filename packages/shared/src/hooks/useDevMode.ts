import { Transaction } from "@mysten/sui/transactions";
import { useCallback, useState } from "react";
import { useToast } from "#/components";
import { useDeviceStore } from "#/stores";
import { useNetworkStore } from "#/stores/networkStore";
import { createLogger } from "#/utils";
import { useWalletSigningContext } from "#/wallet/hooks/useWalletSigningContext";
import { useDevice } from "./useDevice";

const log = createLogger();

/**
 * Hook for handling test transaction submission
 */
export function useDevMode() {
  const { rotateEphemeralKey } = useDevice();
  const { chain } = useNetworkStore();
  const {
    isLocalnet,
    isAuthenticated,
    isWalletUnlocked,
    suiClient,
    getSenderAddress,
    sign,
  } = useWalletSigningContext();
  const { showToast } = useToast();
  const [txDigest, setTxDigest] = useState<string | null>(null);

  const handleTestTransaction = useCallback(async () => {
    try {
      const senderAddress = await getSenderAddress();
      if (!senderAddress) {
        throw new Error("Wallet not ready to sign");
      }

      const tx = new Transaction();
      tx.setSender(senderAddress);
      const txb = await tx.build({ client: suiClient });
      const { signature } = await sign("TransactionData", txb);

      log.debug("Signature ready", { length: signature.length });
      log.debug("Transaction bytes ready", { length: txb.length });

      const txDigestResult = await suiClient.core.executeTransaction({
        transaction: new Uint8Array(txb),
        signatures: [signature],
      });

      if (
        "$kind" in txDigestResult &&
        txDigestResult.$kind === "FailedTransaction"
      ) {
        throw new Error("Transaction failed");
      }
      const txResponse = (
        txDigestResult as { Transaction: { digest?: string | null } }
      ).Transaction;
      const digest = txResponse?.digest ?? null;

      log.info("Transaction executed", { digest });
      setTxDigest(digest);
      showToast("Transaction submitted!");
    } catch (error) {
      log.error("Error submitting transaction", error);
      showToast("Error submitting transaction");
    }
  }, [suiClient, getSenderAddress, sign, showToast]);

  const formatPublicKey = useCallback((bytes: number[] | null | undefined) => {
    if (!bytes || bytes.length === 0) return null;
    return bytes
      .slice(0, 8)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }, []);

  const handleRotateEphKey = useCallback(async () => {
    const beforeState = useDeviceStore.getState();
    const beforeChainData = beforeState.networkData[chain];
    const beforeKey = formatPublicKey(beforeState.ephemeralPublicKeyBytes);

    log.info("Manual eph key rotation requested", {
      chain,
      beforeKey,
      maxEpoch: beforeChainData?.maxEpoch,
      hasNonce: beforeChainData?.nonce != null,
      hasJwtRandomness: beforeChainData?.jwtRandomness != null,
    });

    try {
      await rotateEphemeralKey();

      const afterState = useDeviceStore.getState();
      const afterChainData = afterState.networkData[chain];
      const afterKey = formatPublicKey(afterState.ephemeralPublicKeyBytes);

      log.info("Manual eph key rotation completed", {
        chain,
        beforeKey,
        afterKey,
        maxEpoch: afterChainData?.maxEpoch,
        hasNonce: afterChainData?.nonce != null,
        hasJwtRandomness: afterChainData?.jwtRandomness != null,
      });
    } catch (error) {
      log.error("Manual eph key rotation failed", error);
    }
  }, [chain, formatPublicKey, rotateEphemeralKey]);

  return {
    handleTestTransaction,
    txDigest,
    handleRotateEphKey,
    isAuthenticated: isLocalnet ? isWalletUnlocked : isAuthenticated,
  };
}
