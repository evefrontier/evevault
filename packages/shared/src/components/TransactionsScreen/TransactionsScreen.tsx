import { formatAddress } from "@evevault/shared";
import type {
  TransactionRowProps,
  TransactionsScreenProps,
} from "@evevault/shared/types";
import {
  formatDisplayAmount,
  formatShortDate,
  getSuiscanUrl,
} from "@evevault/shared/utils";
import { useTransactions } from "@evevault/shared/wallet";
import type React from "react";
import { type KeyboardEvent, useMemo, useState } from "react";
import Button from "../Button";
import Heading from "../Heading";
import Icon from "../Icon";
import Text from "../Text";

const TransactionRow: React.FC<TransactionRowProps> = ({
  transaction,
  chain,
  isExpanded,
  onToggle,
}) => {
  const { digest, timestamp, counterparty, amount, tokenSymbol, direction } =
    transaction;

  const suiscanUrl = getSuiscanUrl(chain, digest);
  const formattedDate = formatShortDate(timestamp);
  const formattedAmount = formatDisplayAmount(amount, 5);
  const shortCounterparty = formatAddress(counterparty, 6, 6);
  const shortDigest = formatAddress(digest, 8, 8);

  // Container classes - expands when selected
  const containerClasses = [
    "flex flex-col w-full p-2 gap-2",
    "border-none cursor-pointer text-left transition-colors",
    isExpanded
      ? "bg-quantum-40 hover:bg-quantum-40"
      : "bg-transparent hover:bg-quantum-10",
  ].join(" ");

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle();
    }
  };

  const handleViewOnSuiscan = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(suiscanUrl, "_blank", "noopener,noreferrer");
  };

  // Show direction indicator
  const directionPrefix = direction === "sent" ? "→" : "←";

  return (
    <button
      type="button"
      className={containerClasses}
      onClick={onToggle}
      onKeyDown={handleKeyDown}
      aria-expanded={isExpanded}
    >
      {/* Transaction Row Content */}
      <div className="flex w-full items-center justify-between gap-2">
        <div className="flex items-center">
          <div className="flex items-center w-[72px] shrink-0">
            <Text variant="light" size="small">
              {formattedDate}
            </Text>
          </div>
          <div className="flex items-center gap-1 min-w-0">
            <Text variant="light" size="xsmall" color="neutral-50">
              {directionPrefix}
            </Text>
            <Text variant="light" size="small" color="neutral-90">
              {shortCounterparty}
            </Text>
          </div>
        </div>
        <div className="flex items-center text-right shrink-0">
          <Text variant="regular" size="small">
            {formattedAmount} {tokenSymbol}
          </Text>
        </div>
      </div>

      {/* Expanded Details - Only visible when expanded */}
      {isExpanded && (
        <div className="flex items-center justify-between w-full pt-2 gap-4">
          <div className="flex flex-col gap-1">
            <Text variant="light" size="xsmall" color="neutral-50">
              Transaction:
            </Text>
            <Text variant="light" size="small" color="neutral-90">
              {shortDigest}
            </Text>
          </div>
          <Button
            variant="secondary"
            size="small"
            onClick={handleViewOnSuiscan}
          >
            View on suiscan
          </Button>
        </div>
      )}
    </button>
  );
};

export const TransactionsScreen: React.FC<TransactionsScreenProps> = ({
  user,
  chain,
  onBack,
}) => {
  const [expandedTx, setExpandedTx] = useState<string | null>(null);

  const {
    data,
    isLoading,
    isError,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useTransactions({
    user,
    chain: chain as `sui:${"mainnet" | "testnet" | "devnet" | "localnet"}`,
  });

  // Flatten all pages into a single array
  const transactions = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.transactions);
  }, [data?.pages]);

  const handleToggleExpand = (digest: string) => {
    setExpandedTx(expandedTx === digest ? null : digest);
  };

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const hasTransactions = transactions.length > 0;

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center p-1 bg-transparent border-none cursor-pointer hover:opacity-80"
        >
          <Icon name="ArrowLeft" size="medium" color="quantum" />
        </button>
        <Heading level={2}>Transactions</Heading>
      </div>

      {/* Transaction List Container */}
      <div className="flex flex-col items-start p-4 px-2 gap-4 w-full min-h-[207px] bg-crude-dark border border-quantum-60">
        {/* Labels Row */}
        <div className="flex justify-between items-start gap-2 w-full px-2">
          <div className="flex items-center">
            <Text
              variant="label-semi"
              size="small"
              color="neutral-50"
              className="w-[72px] shrink-0"
            >
              Date
            </Text>
            <Text variant="label-semi" size="small" color="neutral-50">
              Sender / Recipient
            </Text>
          </div>
          <Text
            variant="label-semi"
            size="small"
            color="neutral-50"
            className="text-right shrink-0"
          >
            Amount
          </Text>
        </div>

        {/* Transaction List */}
        <div className="flex flex-col items-start gap-1 w-full max-h-[350px] overflow-y-auto">
          {isLoading && (
            <div className="flex justify-center items-center py-6 w-full">
              <Text size="large" color="grey-neutral">
                Loading transactions...
              </Text>
            </div>
          )}

          {isError && (
            <div className="flex justify-center items-center py-6 w-full">
              <Text size="large" color="error">
                {error?.message || "Failed to load transactions"}
              </Text>
            </div>
          )}

          {!isLoading && !isError && !hasTransactions && (
            <div className="flex justify-center items-center py-6 w-full">
              <Text size="large" color="grey-neutral">
                No transactions found
              </Text>
            </div>
          )}

          {!isLoading &&
            !isError &&
            hasTransactions &&
            transactions.map((tx) => (
              <TransactionRow
                key={tx.digest}
                transaction={tx}
                chain={chain}
                isExpanded={expandedTx === tx.digest}
                onToggle={() => handleToggleExpand(tx.digest)}
              />
            ))}
        </div>

        {/* Load More Button */}
        {hasNextPage && !isLoading && (
          <div className="flex justify-center w-full pt-2">
            <Button
              variant="secondary"
              size="small"
              onClick={handleLoadMore}
              isLoading={isFetchingNextPage}
            >
              {isFetchingNextPage ? "Loading..." : "Load more"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionsScreen;
