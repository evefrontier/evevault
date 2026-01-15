import { formatAddress } from "@evevault/shared";
import type { TokenListProps, TokenRowProps } from "@evevault/shared/types";
import { useBalance } from "@evevault/shared/wallet";
import { useState } from "react";
import { useTokenListStore } from "../../stores/tokenListStore";
import Button from "../Button";
import Icon from "../Icon";
import Text from "../Text";
import { useToast } from "../Toast";

const TokenRow: React.FC<TokenRowProps> = ({
  coinType,
  user,
  chain,
  isSelected,
  onSelect,
  onCopyAddress,
}) => {
  const { data, isLoading } = useBalance({
    user,
    chain,
    coinType,
  });

  const tokenName = data?.metadata?.name || data?.metadata?.symbol || "Token";
  const shortAddress = `${coinType.slice(0, 6)}•••${coinType.slice(-4)}`;
  const balance = isLoading ? "..." : (data?.formattedBalance ?? "0");
  const symbol = data?.metadata?.symbol || "";

  const rowClasses = [
    "flex w-full items-center justify-between gap-1 p-2 h-[38px] min-h-[38px]",
    "border-none cursor-pointer text-left transition-colors",
    isSelected
      ? "bg-[rgba(255,71,0,0.4)] hover:bg-[rgba(255,71,0,0.4)]"
      : "bg-transparent hover:bg-[rgba(255,71,0,0.1)]",
  ].join(" ");

  return (
    <button type="button" className={rowClasses} onClick={onSelect}>
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
            <Icon name="Copy" size="small" color="#8E8C77" />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-6 text-right">
        <Text variant="regular" size="medium">
          {balance} {symbol}
        </Text>
      </div>
    </button>
  );
};

export const TokenSection: React.FC<
  TokenListProps & { walletAddress?: string }
> = ({ user, chain, onAddToken, walletAddress }) => {
  const { tokens, removeToken } = useTokenListStore();
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const { showToast } = useToast();

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
    if (selectedToken) {
      removeToken(selectedToken);
      setSelectedToken(null);
    }
  };

  const hasTokens = tokens.length > 0;

  return (
    <div className="flex flex-col items-start gap-2 w-full  flex-1">
      {/* Wallet Address  */}
      {walletAddress && (
        <div className="flex justify-end items-center gap-2 w-full">
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
              <Icon name="Copy" size="small" color="#8E8C77" />
            </button>
          </div>
        </div>
      )}

      {/* Token List */}
      <div className="flex flex-col items-start p-4 px-2 gap-3 w-full min-h-[207px] max-h-[207px] bg-[#0b0b0b] border border-[rgba(255,71,0,0.6)]">
        {/* Labels Row */}
        <div className="flex justify-between items-start gap-2 w-full">
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
          <Text
            variant="label-semi"
            size="small"
            color="neutral-50"
            className="text-right"
          >
            BALANCE
          </Text>
        </div>

        {/* Token List */}
        <div className="flex flex-col items-start gap-1 w-full min-h-[122px] max-h-[150px] overflow-y-auto">
          {!hasTokens ? (
            <div className="flex justify-center items-center py-6 w-full h-full min-h-[122px]">
              <Text size="large" color="grey-neutral">
                No tokens added yet
              </Text>
            </div>
          ) : (
            tokens.map((coinType) => (
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
              />
            ))
          )}
        </div>
      </div>

      {/* Add/Remove Token Buttons */}
      <div className="flex justify-center items-center gap-4 mt-4 w-full">
        {onAddToken && (
          <Button variant="primary" size="small" onClick={onAddToken}>
            Add Token
          </Button>
        )}
        <Button
          variant="secondary"
          size="small"
          onClick={handleRemoveToken}
          disabled={!selectedToken}
        >
          Remove Token
        </Button>
      </div>
    </div>
  );
};

export const TokenListSection = TokenSection;

export default TokenSection;
