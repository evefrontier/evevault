import { formatAddress } from "@evevault/shared";
import { useNetworkStore } from "@evevault/shared/stores/networkStore";
import type { SendTokenScreenProps } from "@evevault/shared/types";
import { useSendToken } from "@evevault/shared/wallet";
import type React from "react";
import { useEffect, useState } from "react";
import Button from "../Button";
import Heading from "../Heading";
import { Input } from "../Inputs";
import Text from "../Text";
import { useToast } from "../Toast";

/**
 * Generates a Suiscan URL for a transaction
 */
function getSuiscanUrl(chain: string, txDigest: string): string {
  const network = chain.replace("sui:", "");
  return `https://suiscan.xyz/${network}/tx/${txDigest}`;
}

export const SendTokenScreen: React.FC<SendTokenScreenProps> = ({
  coinType,
  onCancel,
}) => {
  const { showToast } = useToast();
  const { chain: currentChain } = useNetworkStore();
  const [recipientAddress, setRecipientAddress] = useState("");
  const [amount, setAmount] = useState("");
  // Store the submitted values to show on success screen
  const [submittedRecipient, setSubmittedRecipient] = useState("");
  const [submittedAmount, setSubmittedAmount] = useState("");

  const {
    currentBalance,
    tokenSymbol,
    canSend,
    validationErrors,
    isLoading,
    error,
    txDigest,
    send,
    isValidRecipient,
    isValidAmount,
  } = useSendToken({
    coinType,
    recipientAddress,
    amount,
  });

  const handleRecipientChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setRecipientAddress(event.target.value.trim());
  };

  const handleAmountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    // Allow only valid number input
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
    }
  };

  const handleSend = async () => {
    // Store the values before sending so we can show them on success screen
    setSubmittedRecipient(recipientAddress);
    setSubmittedAmount(amount);
    await send();
    // Don't call onSuccess here - let the success screen show first
  };

  // Show toast when error occurs
  useEffect(() => {
    if (error) {
      showToast("Transaction failed");
    }
  }, [error, showToast]);

  // Show toast when transaction succeeds
  useEffect(() => {
    if (txDigest) {
      showToast("Transaction confirmed!");
    }
  }, [txDigest, showToast]);

  // Show success/confirmation screen
  if (txDigest) {
    const suiscanUrl = currentChain
      ? getSuiscanUrl(currentChain, txDigest)
      : null;

    const handleViewOnSuiscan = () => {
      if (suiscanUrl) {
        window.open(suiscanUrl, "_blank", "noopener,noreferrer");
      }
    };

    return (
      <div className="flex flex-col gap-20">
        {/* Header + Transaction Details */}
        <div className="flex flex-col gap-6">
          {/* Title */}
          <Heading level={2}>Transfer completed</Heading>

          {/* Transaction Details */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <Text variant="bold" size="small" color="neutral-90">
                Amount sent
              </Text>
              <Text variant="light" size="small" color="neutral-90">
                {submittedAmount} {tokenSymbol}
              </Text>
            </div>

            <div className="flex justify-between items-center">
              <Text variant="bold" size="small" color="neutral-90">
                Recipient address
              </Text>
              <Text variant="light" size="small" color="neutral-90">
                {formatAddress(submittedRecipient, 8, 8)}
              </Text>
            </div>

            <div className="flex justify-between items-center">
              <Text variant="bold" size="small" color="neutral-90">
                Transaction
              </Text>
              <Text variant="light" size="small" color="neutral-90">
                {formatAddress(txDigest, 8, 8)}
              </Text>
            </div>
          </div>
        </div>

        {/* Buttons - Centered */}
        <div className="flex justify-center gap-1">
          <Button onClick={onCancel}>close</Button>
          {suiscanUrl && (
            <Button variant="secondary" onClick={handleViewOnSuiscan}>
              View on suiscan
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Derive input errors for display
  const recipientError =
    recipientAddress && !isValidRecipient
      ? "Invalid Sui address format"
      : undefined;
  const amountError =
    amount && !isValidAmount ? "Invalid amount or exceeds balance" : undefined;

  // Filter validation errors for display (exclude input-specific ones)
  const systemErrors = validationErrors.filter(
    (e) => !e.includes("Invalid Sui address") && !e.includes("Invalid amount"),
  );

  return (
    <div className="flex flex-col gap-10">
      {/* Header Section - gap-4 between title and description */}
      <div className="flex flex-col gap-4">
        <Heading level={2}>Transfer token</Heading>
        <Text variant="light" size="large" color="neutral-90">
          Enter the recipient address and amount
        </Text>
      </div>

      {/* Form Section - gap-10 between form groups */}
      <div className="flex flex-col gap-10 items-end">
        {/* System Validation Errors */}
        {systemErrors.length > 0 && (
          <div className="p-2 bg-red-10/10 border border-red-10/30 w-full">
            {systemErrors.map((err) => (
              <Text key={err} variant="light" size="xsmall" color="error">
                {err}
              </Text>
            ))}
          </div>
        )}

        {/* Input Row + Balance - gap-4 */}
        <div className="flex flex-col gap-4 w-full items-end">
          {/* Input Row: Recipient Address + Amount - gap-6 */}
          <div className="flex gap-6 items-start w-full">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="Recipient Address"
                value={recipientAddress}
                errorText={recipientError}
                onChange={handleRecipientChange}
              />
            </div>
            <div className="w-[160px]">
              <Input
                type="text"
                placeholder="Amount"
                value={amount}
                errorText={amountError}
                onChange={handleAmountChange}
              />
            </div>
          </div>

          {/* Wallet Balance - Right aligned */}
          <Text
            variant="light"
            size="small"
            color="neutral-90"
            className="whitespace-nowrap"
          >
            Wallet balance:{" "}
            <span className="font-medium">
              {currentBalance} {tokenSymbol}
            </span>
          </Text>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-2 bg-red-10/10 border border-red-10/30 w-full">
            <Text variant="light" size="xsmall" color="error">
              {error}
            </Text>
          </div>
        )}

        {/* Action Buttons - gap-1 (DuoButton style) */}
        <div className="flex gap-1">
          <Button
            disabled={!canSend || isLoading}
            isLoading={isLoading}
            onClick={handleSend}
          >
            {isLoading ? "Sending..." : "transfer"}
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            cancel
          </Button>
        </div>
      </div>
    </div>
  );
};
