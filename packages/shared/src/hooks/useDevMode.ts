import { getUserForNetwork, useAuth } from "@evevault/shared/auth";
import { useToast } from "@evevault/shared/components";
import { useDevice } from "@evevault/shared/hooks";
import { useNetworkStore } from "@evevault/shared/stores/networkStore";
import { createSuiClient } from "@evevault/shared/sui";
import { createLogger } from "@evevault/shared/utils";
import { zkSignAny } from "@evevault/shared/wallet";
import { Transaction } from "@mysten/sui/transactions";
import { useCallback, useMemo, useState } from "react";
import { useDeviceStore } from "../stores";

const log = createLogger();

/**
 * Hook for handling test transaction submission
 */
export function useDevMode() {
  const { user: globalUser } = useAuth();
  const { getZkProof, rotateEphemeralKey } = useDevice();
  const { chain } = useNetworkStore();
  const { showToast } = useToast();
  const [txDigest, setTxDigest] = useState<string | null>(null);

  const suiClient = useMemo(() => createSuiClient(chain), [chain]);

  const handleTestTransaction = useCallback(async () => {
    try {
      // Get user from stored JWT for current network, not the global OIDC user
      // which may be from a different network
      const user = await getUserForNetwork(chain);

      if (!user) {
        log.error("User not found", { user });
        throw new Error("User not found");
      }

      const tx = new Transaction();
      tx.setSender(user.profile?.sui_address as string);
      const txb = await tx.build({ client: suiClient });

      const { bytes, zkSignature } = await zkSignAny("TransactionData", txb, {
        user,
        getZkProof,
      });
      log.debug("zkSignature ready", { length: zkSignature.length });
      log.debug("Transaction bytes ready", { length: bytes.length });

      const txDigestResult = await suiClient.core.executeTransaction({
        transaction: new Uint8Array(txb),
        signatures: [zkSignature],
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
  }, [chain, suiClient, getZkProof, showToast]);

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
      beforeChainData,
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
        beforeChainData,
        afterChainData,
      });
    } catch (error) {
      log.error("Manual eph key rotation failed", error);
    }
  }, [chain, formatPublicKey, rotateEphemeralKey]);

  return {
    handleTestTransaction,
    txDigest,
    handleRotateEphKey,
    isAuthenticated: !!globalUser,
  };
}
