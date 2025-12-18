import type { AddTokenScreenProps } from "@evevault/shared/types";
import type React from "react";
import { useState } from "react";
import { useTokenListStore } from "../../stores/tokenListStore";
import Button from "../Button";
import Heading from "../Heading";
import { Input } from "../Inputs";
import Text from "../Text";
import { useToast } from "../Toast";

export const AddTokenScreen: React.FC<AddTokenScreenProps> = ({
  user,
  chain,
  onSuccess,
  onCancel,
}) => {
  const { addToken } = useTokenListStore();
  const { showToast } = useToast();
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleAddToken = () => {
    const normalized = inputValue.trim();
    if (!normalized) {
      setError("Please enter a coin type");
      showToast("Failed to add token");
      return;
    }

    // Basic validation for Sui coin type format
    if (!normalized.match(/^0x[a-fA-F0-9]+::\w+::\w+$/)) {
      setError("Invalid coin type format. Expected: 0x...::module::COIN");
      showToast("Failed to add token");
      return;
    }

    addToken(normalized);
    setInputValue("");
    setError(null);
    showToast("Token added");

    if (onSuccess) {
      onSuccess();
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
    setError(null);
  };

  const canAdd = !!user && !!chain && inputValue.trim().length > 0;

  return (
    <div className="mt-10 flex flex-col gap-10">
      <div>
        <Heading level={2} className="mb-4">
          Add custom token
        </Heading>
        <Text variant="light" size="large" className="mb-2">
          Enter the full coin type identifier to track custom token balance.{" "}
        </Text>
        <Text variant="light" size="xsmall">
          Make sure you enter the correct coin type. Invalid or malicious tokens
          could cause issues. Only add tokens you trust
        </Text>
      </div>

      <Input
        type="text"
        label="Token identifier"
        placeholder="0x...::module::COIN"
        value={inputValue}
        errorText={error || undefined}
        onChange={handleInputChange}
        className="w-full rounded border border-[var(--matter-05)] bg-transparent px-3 py-2.5 text-[var(--neutral)] outline-none focus:border-[var(--matter-05)]"
      />
      <div className="flex gap-2">
        <Button disabled={!canAdd} onClick={handleAddToken}>
          Add Token
        </Button>
        <Button variant="secondary" size="small" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
};
