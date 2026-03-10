import { useQueryClient } from "@tanstack/react-query";
import type React from "react";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useResponsive } from "../../hooks";
import { useTokenListStore } from "../../stores/tokenListStore";
import type { TokenListProps, TokenRowProps } from "../../types";
import { getDefaultTokensForChain } from "../../types/networks";
import { formatAddress } from "../../utils";
import { useBalance } from "../../wallet";
import { getKnownTokenDisplay } from "../../wallet/utils/balanceMetadata";
import Button from "../Button";
import Icon from "../Icon";
import Text from "../Text";
import { useToast } from "../Toast";

const SCRAMBLE_INTERVAL_MS = 200;

/**
 * Scrambles the balance so the first digit never changes and the displayed value
 * never exceeds the actual balance. Uses BigInt so large balances don't hit
 * Number.MAX_SAFE_INTEGER or lose precision.
 */
function scrambleBalanceWithFixedFirst(text: string): string {
  if (!text || text === "...") return text;
  const normalized = text.replace(/,/g, "");
  const dotIndex = normalized.indexOf(".");
  const integerPart =
    dotIndex >= 0 ? normalized.slice(0, dotIndex) : normalized;
  const decimalPart = dotIndex >= 0 ? normalized.slice(dotIndex + 1) : "";
  const fullDigits = (integerPart + decimalPart).split("");
  if (fullDigits.length === 0) return text;

  const valueInUnits =
    BigInt(integerPart || "0") * 10n ** BigInt(decimalPart.length) +
    BigInt(decimalPart || "0");
  const totalDigits = fullDigits.length;
  const integerDigitsCount = integerPart.length;

  const result: string[] = [];
  for (let i = 0; i < totalDigits; i++) {
    if (i === 0) {
      result.push(fullDigits[0] ?? "0");
      continue;
    }
    const currentValue = BigInt(result.join("") + "0".repeat(totalDigits - i));
    const remainingPower = 10n ** BigInt(totalDigits - i - 1);
    const headroom = valueInUnits - currentValue;
    if (headroom < 0n) {
      result.push("0");
      continue;
    }
    const maxDigitNum = Number(headroom / remainingPower);
    const maxDigit = Math.min(9, Math.max(0, maxDigitNum));
    const digit = Math.floor(Math.random() * (maxDigit + 1));
    result.push(String(digit));
  }

  const resultInteger = result.slice(0, integerDigitsCount).join("");
  const resultDecimal = result.slice(integerDigitsCount).join("");
  return resultDecimal ? `${resultInteger}.${resultDecimal}` : resultInteger;
}

/** Replaces each letter (a-z, A-Z) with a random uppercase letter; non-letters unchanged. */
function scrambleLetters(text: string): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return text
    .split("")
    .map((char) => {
      if (char >= "a" && char <= "z")
        return letters[Math.floor(Math.random() * 26)];
      if (char >= "A" && char <= "Z")
        return letters[Math.floor(Math.random() * 26)];
      return char;
    })
    .join("");
}

/** Three dots with staggered blink animation (uses --quantum in theme). */
function LoadingDots() {
  return (
    <span className="loading-dots" aria-hidden>
      <span>.</span>
      <span>.</span>
      <span>.</span>
    </span>
  );
}

interface ExtendedTokenRowProps extends TokenRowProps {
  onTransfer?: () => void;
  isRefreshing?: boolean;
  /** When isRefreshing, each tick drives a new scramble so one timer can update all rows. */
  refreshTick?: number;
}

const TokenRow: React.FC<ExtendedTokenRowProps> = ({
  coinType,
  user,
  chain,
  isSelected,
  onSelect,
  onCopyAddress,
  onTransfer,
  isRefreshing = false,
  refreshTick = 0,
}) => {
  const { data, isLoading } = useBalance({
    user,
    chain,
    coinType,
  });

  const knownDisplay = getKnownTokenDisplay(coinType);
  const tokenName =
    data?.metadata?.name ||
    data?.metadata?.symbol ||
    knownDisplay?.name ||
    "Token";
  const shortAddress = `${coinType.slice(0, 6)}•••${coinType.slice(-4)}`;
  const balance = isLoading ? "..." : (data?.formattedBalance ?? "0");
  const symbol = data?.metadata?.symbol || knownDisplay?.symbol || "";

  // refreshTick is a prop that drives re-scramble each tick; linter doesn't see it as triggering re-render
  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshTick prop drives re-scramble each 200ms
  const displayBalance = useMemo(
    () => (isRefreshing ? scrambleBalanceWithFixedFirst(balance) : balance),
    [isRefreshing, balance, refreshTick],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshTick prop drives re-scramble each 200ms
  const displaySymbol = useMemo(
    () => (isRefreshing ? scrambleLetters(symbol) : symbol),
    [isRefreshing, symbol, refreshTick],
  );

  // Container classes - expands when selected
  const containerClasses = [
    "flex flex-col w-full p-2 gap-4",
    "border-none cursor-pointer text-left transition-colors",
    isSelected
      ? "bg-quantum-40 hover:bg-quantum-40"
      : "bg-transparent hover:bg-quantum-10",
  ].join(" ");

  const handleTransferClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onTransfer) {
      onTransfer();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  };

  return (
    <button
      type="button"
      className={containerClasses}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      aria-pressed={isSelected}
    >
      {/* Token Row Content */}
      <div className="flex w-full items-center justify-between gap-1">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 w-[140px]">
            <Text variant="bold" size="medium">
              {tokenName}
            </Text>
          </div>
          <div className="flex items-center gap-1">
            <Text variant="light" size="small" color="grey-neutral">
              {shortAddress}
            </Text>
            <button
              type="button"
              className="flex items-center justify-center w-4 h-4 p-0 bg-transparent border-none cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onCopyAddress(coinType);
              }}
            >
              <Icon name="Copy" size="small" color="grey-neutral" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-6 text-right">
          <Text variant="regular" size="medium">
            {displayBalance}
            {isRefreshing ? <LoadingDots /> : null} {displaySymbol}
          </Text>
        </div>
      </div>

      {/* Transfer Button - Only visible when selected */}
      {isSelected && onTransfer && (
        <div className="flex justify-end w-full">
          <Button
            variant="secondary"
            size="small"
            onClick={handleTransferClick}
          >
            Transfer
          </Button>
        </div>
      )}
    </button>
  );
};

const REFRESH_TIMEOUT_MS = 10000;

export const TokenSection: React.FC<
  TokenListProps & { walletAddress?: string }
> = ({ user, chain, onAddToken, onSendToken, walletAddress }) => {
  const queryClient = useQueryClient();
  const { tokens, removeToken } = useTokenListStore();
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const scrambleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const { showToast } = useToast();
  const { isMobile } = useResponsive();

  useEffect(() => {
    return () => {
      if (scrambleIntervalRef.current != null) {
        clearInterval(scrambleIntervalRef.current);
      }
    };
  }, []);

  const handleRefreshBalances = useCallback(async () => {
    if (isRefreshing) return;
    if (scrambleIntervalRef.current != null) {
      clearInterval(scrambleIntervalRef.current);
      scrambleIntervalRef.current = null;
    }
    setIsRefreshing(true);
    setRefreshTick(0);
    scrambleIntervalRef.current = setInterval(() => {
      setRefreshTick((t) => t + 1);
    }, SCRAMBLE_INTERVAL_MS);
    try {
      await Promise.race([
        Promise.all([
          queryClient.refetchQueries({
            queryKey: ["coin-balance"],
            type: "all",
          }),
          queryClient.refetchQueries({
            queryKey: ["transactions"],
            type: "all",
          }),
        ]),
        new Promise<void>((resolve) => setTimeout(resolve, REFRESH_TIMEOUT_MS)),
      ]);
    } finally {
      if (scrambleIntervalRef.current != null) {
        clearInterval(scrambleIntervalRef.current);
        scrambleIntervalRef.current = null;
      }
      setIsRefreshing(false);
    }
  }, [queryClient, isRefreshing]);

  const tokensForChain = useMemo(
    () => (chain ? (tokens[chain] ?? getDefaultTokensForChain(chain)) : []),
    [chain, tokens],
  );

  const handleCopyAddress = async (address: string) => {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(address);
      showToast("Copied!");
    } catch (_e) {
      showToast("Copy failed");
    }
  };

  const handleRemoveToken = () => {
    if (selectedToken && chain) {
      removeToken(chain, selectedToken);
      setSelectedToken(null);
    }
  };

  const handleTransfer = (coinType: string) => {
    if (onSendToken) {
      onSendToken(coinType);
    }
  };
  const hasTokens = tokensForChain.length > 0;

  return (
    <div className="flex flex-col items-start gap-2 w-full flex-1 min-h-0">
      {/* Wallet Address or spacer */}
      {walletAddress ? (
        <div className="flex justify-end items-center gap-2 w-full flex-shrink-0">
          <div className="flex items-center gap-1">
            <Text variant="regular" size="small" color="neutral-80">
              Wallet address:
            </Text>
            <button
              type="button"
              className="flex items-center gap-1 px-1 py-0.5 bg-transparent border-none cursor-pointer hover:opacity-80"
              onClick={() => handleCopyAddress(walletAddress)}
            >
              <Text variant="light" size="small" color="grey-neutral">
                {formatAddress(walletAddress)}
              </Text>
              <Icon name="Copy" size="small" color="grey-neutral" />
            </button>
          </div>
        </div>
      ) : (
        <div className="h-6 flex-shrink-0" />
      )}

      {/* Token List */}
      <div
        className={`flex flex-col items-start p-4 px-2 gap-3 w-full bg-crude-dark border border-quantum-60 overflow-hidden ${isMobile ? "" : "flex-1 min-h-[300px]"}`}
        style={isMobile ? { height: "207px", flexShrink: 0 } : undefined}
      >
        {/* Labels Row */}
        <div className="flex justify-between items-start gap-2 w-full flex-shrink-0">
          <div className="flex items-center gap-[60px]">
            <Text
              variant="label-semi"
              size="small"
              color="neutral-50"
              className="w-[140px]"
            >
              TOKEN
            </Text>
            <Text
              variant="label-semi"
              size="small"
              color="neutral-50"
              className="w-[60px]"
            >
              ADDRESS
            </Text>
          </div>
          <button
            type="button"
            className="flex items-center justify-end gap-1 bg-transparent border-none cursor-pointer rounded opacity-90 hover:opacity-100 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed text-left min-w-0"
            onClick={handleRefreshBalances}
            disabled={isRefreshing}
            title="Refresh balances"
            aria-label="Refresh balances"
          >
            <Text
              variant="label-semi"
              size="small"
              color="neutral-50"
              className="text-right"
            >
              BALANCE
            </Text>
            <Icon
              name="Refresh"
              width={12}
              height={12}
              color="grey-neutral"
              className={`flex-shrink-0 -mt-1 ${isRefreshing ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        {/* Token List - Scrollable */}
        <div className="flex flex-col items-start gap-1 w-full flex-1 min-h-0 overflow-y-auto">
          {!hasTokens ? (
            <div className="flex justify-center items-center py-6 w-full">
              <Text size="large" color="grey-neutral">
                No tokens added yet
              </Text>
            </div>
          ) : (
            tokensForChain.map((coinType: string) => (
              <TokenRow
                key={coinType}
                coinType={coinType}
                user={user}
                chain={chain}
                isSelected={selectedToken === coinType}
                onSelect={() =>
                  setSelectedToken(selectedToken === coinType ? null : coinType)
                }
                onCopyAddress={handleCopyAddress}
                onTransfer={
                  onSendToken ? () => handleTransfer(coinType) : undefined
                }
                isRefreshing={isRefreshing}
                refreshTick={refreshTick}
              />
            ))
          )}
        </div>
      </div>

      {/* Add / Remove Token Buttons */}
      <div className="flex justify-center items-center gap-1 w-full flex-shrink-0">
        {onAddToken && (
          <Button variant="primary" size="small" onClick={onAddToken}>
            Add token
          </Button>
        )}
        <Button
          variant="secondary"
          size="small"
          onClick={handleRemoveToken}
          disabled={!selectedToken || !chain}
        >
          Remove token
        </Button>
      </div>
    </div>
  );
};

export const TokenListSection = TokenSection;

export default TokenSection;
