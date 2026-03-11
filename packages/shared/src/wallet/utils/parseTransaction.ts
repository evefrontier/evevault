import type { SuiGraphQLClient } from "@mysten/sui/graphql";
import type {
  Transaction,
  TransactionBalanceChange,
  TransactionDirection,
} from "../../types/components";
import { SUI_COIN_TYPE } from "../../utils";
import { formatByDecimals } from "../../utils/format";
import { createLogger } from "../../utils/logger";
import type {
  GraphQLBalanceChange,
  GraphQLTransactionNode,
} from "../types/graphql";
import { fetchCoinMetadata } from "./coinMetadata";
import { extractSymbolFromCoinType } from "./formatTransaction";

const log = createLogger();

function findCounterparty(
  balanceChanges: GraphQLBalanceChange[],
  userAddress: string,
  direction: TransactionDirection,
  coinType: string,
): string {
  const isReceived = direction === "received";
  const oppositeSign = isReceived
    ? (amount: bigint) => amount < 0n
    : (amount: bigint) => amount > 0n;
  const sameCoinType = (bc: GraphQLBalanceChange) =>
    (bc.coinType?.repr ?? SUI_COIN_TYPE) === coinType;
  const notUser = (bc: GraphQLBalanceChange) =>
    bc.owner?.address?.toLowerCase() !== userAddress.toLowerCase();

  const withOppositeSign = balanceChanges.filter((bc) => {
    if (!bc.amount) return false;
    return oppositeSign(BigInt(bc.amount)) && notUser(bc);
  });
  const sameCoin = withOppositeSign.find(sameCoinType);
  const counterpartyChange = sameCoin ?? withOppositeSign[0];
  return counterpartyChange?.owner?.address ?? "System";
}

/**
 * Parses a GraphQL transaction response into our Transaction format.
 * Returns one Transaction per digest with all user balance changes (e.g. EVE + SUI gas) in one row.
 */
export async function parseGraphQLTransaction(
  txNode: GraphQLTransactionNode,
  userAddress: string,
  graphqlClient: SuiGraphQLClient,
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

  const ts = timestamp ? new Date(timestamp).getTime() : Date.now();

  const userChanges = balanceChanges.filter((bc) => {
    const owner = bc.owner?.address;
    return (
      owner?.toLowerCase() === userAddress.toLowerCase() && bc.amount != null
    );
  });

  if (userChanges.length > 0) {
    const balanceChangeItems: TransactionBalanceChange[] = [];

    for (const userBalanceChange of userChanges) {
      if (userBalanceChange.amount == null) continue;
      const amount = BigInt(userBalanceChange.amount);
      const coinType = userBalanceChange.coinType?.repr ?? SUI_COIN_TYPE;
      const amountAbs = amount >= 0n ? amount : amount * -1n;
      const isDebit = amount < 0n;

      const metadata = await fetchCoinMetadata(graphqlClient, coinType);
      const decimals = metadata?.decimals ?? 9;
      if (!metadata) {
        log.warn("Falling back to default decimals for coin type", {
          coinType,
          rawAmount: amountAbs.toString(),
          defaultDecimals: decimals,
        });
      }

      balanceChangeItems.push({
        amount: formatByDecimals(amountAbs.toString(), decimals),
        tokenSymbol: metadata?.symbol ?? extractSymbolFromCoinType(coinType),
        tokenName: metadata?.name ?? undefined,
        coinType,
        isDebit,
      });
    }

    if (balanceChangeItems.length === 0) return null;

    const nonSuiUserChanges = userChanges.filter((change) => {
      const ct = change.coinType?.repr ?? SUI_COIN_TYPE;
      return ct !== SUI_COIN_TYPE && change.amount != null;
    });
    const primaryUserChange =
      nonSuiUserChanges[0] ??
      userChanges.find((change) => change.amount != null) ??
      userChanges[0];
    const primaryAmount =
      primaryUserChange?.amount != null
        ? BigInt(primaryUserChange.amount)
        : 0n;
    const direction: TransactionDirection =
      primaryAmount >= 0n ? "received" : "sent";
    const primaryCoinType =
      primaryUserChange?.coinType?.repr ?? SUI_COIN_TYPE;
    const primary =
      balanceChangeItems.find((bc) => bc.coinType === primaryCoinType) ??
      balanceChangeItems.find((bc) => bc.coinType !== SUI_COIN_TYPE) ??
      balanceChangeItems[0];
    const counterparty = findCounterparty(
      balanceChanges,
      userAddress,
      direction,
      primary.coinType,
    );

    return {
      digest,
      timestamp: ts,
      direction,
      counterparty,
      balanceChanges: balanceChangeItems,
    };
  }

  const outgoingChange = balanceChanges.find((bc) => {
    if (!bc.amount) return false;
    return BigInt(bc.amount) < 0n;
  });

  if (!outgoingChange || !outgoingChange.amount) {
    return null;
  }

  const recipientChange = balanceChanges.find((bc) => {
    if (!bc.amount) return false;
    const amount = BigInt(bc.amount);
    if (amount <= 0n) return false;
    const ownerAddress = bc.owner?.address;
    return ownerAddress?.toLowerCase() !== userAddress.toLowerCase();
  });
  const counterparty = recipientChange?.owner?.address ?? "System";

  const amountAbs = BigInt(outgoingChange.amount) * -1n;
  const coinType = outgoingChange.coinType?.repr ?? SUI_COIN_TYPE;

  const metadata = await fetchCoinMetadata(graphqlClient, coinType);
  const decimals = metadata?.decimals ?? 9;
  if (!metadata) {
    log.warn("Falling back to default decimals for coin type", {
      coinType,
      rawAmount: amountAbs.toString(),
      defaultDecimals: decimals,
    });
  }

  return {
    digest,
    timestamp: ts,
    direction: "sent",
    counterparty,
    balanceChanges: [
      {
        amount: formatByDecimals(amountAbs.toString(), decimals),
        tokenSymbol: metadata?.symbol ?? extractSymbolFromCoinType(coinType),
        tokenName: metadata?.name ?? undefined,
        coinType,
        isDebit: true,
      },
    ],
  };
}
