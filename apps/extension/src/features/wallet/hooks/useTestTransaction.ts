import { useAuth } from "@evevault/shared/auth";
import { useToast } from "@evevault/shared/components";
import { useDevice } from "@evevault/shared/hooks";
import { useNetworkStore } from "@evevault/shared/stores/networkStore";
import { createSuiClient } from "@evevault/shared/sui";
import { createLogger } from "@evevault/shared/utils";
import { zkSignAny } from "@evevault/shared/wallet";
import { Transaction } from "@mysten/sui/transactions";
import { useCallback, useMemo, useState } from "react";

const log = createLogger();

/**
 * Hook for handling test transaction submission
 */
export function useTestTransaction() {
  const { user } = useAuth();
  const { ephemeralPublicKey, getZkProof, maxEpoch } = useDevice();
  const { chain } = useNetworkStore();
  const { showToast } = useToast();
  const [txDigest, setTxDigest] = useState<string | null>(null);

  const suiClient = useMemo(() => createSuiClient(chain), [chain]);

  const handleTestTransaction = useCallback(async () => {
    try {
      if (!user || !maxEpoch) {
        log.error("User or max epoch not found", { user, maxEpoch });
        throw new Error("User or max epoch not found");
      }
      if (!ephemeralPublicKey) {
        throw new Error("Ephemeral public key not found");
      }

      const tx = new Transaction();
      tx.setSender(user.profile?.sui_address as string);
      const txb = await tx.build({ client: suiClient });

      const { bytes, zkSignature } = await zkSignAny("TransactionData", txb, {
        user,
        ephemeralPublicKey,
        maxEpoch,
        getZkProof,
      });
      log.debug("zkSignature ready", { length: zkSignature.length });
      log.debug("Transaction bytes ready", { length: bytes.length });

      const txDigestResult = await suiClient.executeTransactionBlock({
        transactionBlock: bytes,
        signature: zkSignature,
      });

      log.info("Transaction executed", { digest: txDigestResult.digest });
      setTxDigest(txDigestResult.digest);
      showToast("Transaction submitted!");
    } catch (error) {
      log.error("Error submitting transaction", error);
      showToast("Error submitting transaction");
    }
  }, [user, maxEpoch, ephemeralPublicKey, suiClient, getZkProof, showToast]);

  return { handleTestTransaction, txDigest };
}
