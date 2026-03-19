import { Transaction } from "@mysten/sui/transactions";
import { fromBase64, toBase64 } from "@mysten/sui/utils";

/** Matches comma-separated decimal bytes (e.g. "0,0,2,0,32,...") */
const COMMA_SEPARATED_BYTES = /^\d+(,\d+)*$/;

export type ParseTransactionBytesResult = {
  /** Display-ready string for the Json component */
  displayValue: string;
  /** When input was comma-separated bytes, base64 for Transaction.from(); otherwise undefined (use original) */
  transactionForSigning?: string;
};

async function bytesToDisplayJson(bytes: Uint8Array): Promise<string> {
  const tx = Transaction.from(bytes);
  const json = await tx.toJSON();
  const parsed = (typeof json === "string" ? JSON.parse(json) : json) as Record<
    string,
    unknown
  >;
  return JSON.stringify(parsed, null, 2);
}

/**
 * Returns a display-ready string and optional signing-ready transaction from pending storage.
 * Accepts the raw value (string or object from chrome.storage). If it is
 * comma-separated bytes, parses to human-readable JSON and base64 for signing.
 * If it is base64, parses to human-readable JSON for display only.
 * Otherwise returns the normalized string.
 */
export async function parseTransactionBytes(
  transaction: string | Record<string, unknown>,
): Promise<ParseTransactionBytesResult> {
  const str =
    typeof transaction === "string"
      ? transaction
      : JSON.stringify(transaction, null, 2);

  const trimmed = str.trim();

  if (COMMA_SEPARATED_BYTES.test(trimmed)) {
    try {
      const bytes = new Uint8Array(
        trimmed.split(",").map((s) => Number(s.trim())),
      );
      const displayValue = await bytesToDisplayJson(bytes);
      return {
        displayValue,
        transactionForSigning: toBase64(bytes),
      };
    } catch {
      return { displayValue: str };
    }
  }

  try {
    const bytes = fromBase64(trimmed);
    const displayValue = await bytesToDisplayJson(bytes);
    return { displayValue };
  } catch {
    return { displayValue: str };
  }
}
