import type { Transaction, TransactionDirection } from "../../types/components";
import { SUI_COIN_TYPE } from "../../utils";
import type { GraphQLTransactionNode } from "../types/graphql";
import {
  extractSymbolFromCoinType,
  formatTransactionAmount,
} from "./formatTransaction";

/**
 * Parses a GraphQL transaction response into our Transaction format
 *
 * Note: In the current schema (2025+), timestamp is on effects, not transaction,
 * and BalanceChange.owner is an Address object directly (not Owner union).
 */
export async function parseGraphQLTransaction(
  txNode: GraphQLTransactionNode,
  userAddress: string,
  suiClient: ReturnType<typeof import("../../sui").createSuiClient>,
): Promise<Transaction | null> {
  const { digest, effects } = txNode;

  if (!digest || !effects?.balanceChanges?.nodes) {
    return null;
  }

  const timestamp = effects.timestamp;
  const balanceChanges = effects.balanceChanges.nodes;

  if (balanceChanges.length === 0) {
    return null;
  }

  // Find the balance change relevant to the user
  const userBalanceChange = balanceChanges.find((bc) => {
    const ownerAddress = bc.owner?.address;
    return ownerAddress?.toLowerCase() === userAddress.toLowerCase();
  });

  if (!userBalanceChange || !userBalanceChange.amount) {
    // If no balance change for user, try to find outgoing transaction
    const outgoingChange = balanceChanges.find((bc) => {
      if (!bc.amount) return false;
      const amount = BigInt(bc.amount);
      return amount < 0n;
    });

    if (!outgoingChange || !outgoingChange.amount) {
      return null;
    }

    // User sent this transaction - find recipient
    const recipientChange = balanceChanges.find((bc) => {
      if (!bc.amount) return false;
      const amount = BigInt(bc.amount);
      if (amount <= 0n) return false;
      const ownerAddress = bc.owner?.address;
      return ownerAddress?.toLowerCase() !== userAddress.toLowerCase();
    });

    // If no recipient found, it's likely a gas-only or system-level transaction
    const counterparty = recipientChange?.owner?.address || "System";

    const amountAbs = BigInt(outgoingChange.amount) * -1n;
    const coinType = outgoingChange.coinType?.repr || SUI_COIN_TYPE;

    return {
      digest,
      timestamp: timestamp ? new Date(timestamp).getTime() : Date.now(),
      direction: "sent" as TransactionDirection,
      counterparty,
      amount: await formatTransactionAmount(
        amountAbs.toString(),
        coinType,
        suiClient,
      ),
      tokenSymbol: extractSymbolFromCoinType(coinType),
      coinType,
    };
  }

  const amount = BigInt(userBalanceChange.amount);
  const direction: TransactionDirection = amount >= 0n ? "received" : "sent";
  const coinType = userBalanceChange.coinType?.repr || SUI_COIN_TYPE;

  // Find counterparty (sender if received, recipient if sent)
  let counterparty: string;

  if (direction === "received") {
    // Find who sent it (negative balance change)
    const senderChange = balanceChanges.find((bc) => {
      if (!bc.amount) return false;
      const bcAmount = BigInt(bc.amount);
      if (bcAmount >= 0n) return false;
      const ownerAddress = bc.owner?.address;
      return ownerAddress?.toLowerCase() !== userAddress.toLowerCase();
    });

    // If no sender found, it's likely a mint/system-originated transfer
    counterparty = senderChange?.owner?.address || "System";
  } else {
    // Find who received it (positive balance change)
    const recipientChange = balanceChanges.find((bc) => {
      if (!bc.amount) return false;
      const bcAmount = BigInt(bc.amount);
      if (bcAmount <= 0n) return false;
      const ownerAddress = bc.owner?.address;
      return ownerAddress?.toLowerCase() !== userAddress.toLowerCase();
    });

    // If no recipient found, it's likely a gas-only or system-level transaction
    counterparty = recipientChange?.owner?.address || "System";
  }

  const amountAbs = amount >= 0n ? amount : amount * -1n;

  return {
    digest,
    timestamp: timestamp ? new Date(timestamp).getTime() : Date.now(),
    direction,
    counterparty,
    amount: await formatTransactionAmount(
      amountAbs.toString(),
      coinType,
      suiClient,
    ),
    tokenSymbol: extractSymbolFromCoinType(coinType),
    coinType,
  };
}
