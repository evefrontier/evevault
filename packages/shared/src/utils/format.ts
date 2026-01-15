/**
 * Formats a raw token amount by its decimals into a human-readable string.
 *
 * @param amount - The raw token amount as a string
 * @param decimals - The number of decimal places
 * @returns Formatted balance string with appropriate decimal places
 *
 * @example
 * formatByDecimals("1000000000", 9) // Returns "1"
 * formatByDecimals("1500000000", 9) // Returns "1.5"
 * formatByDecimals("1234567890", 9) // Returns "1.23456789"
 */
export function formatByDecimals(amount: string, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const value = BigInt(amount);
  const integer = value / divisor;
  const fraction = value % divisor;

  if (fraction === 0n) {
    return integer.toString();
  }

  const fractionStr = fraction
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");

  return `${integer.toString()}.${fractionStr}`;
}

/**
 * Converts a human-readable decimal amount to the smallest unit (e.g., SUI to MIST).
 * This is the inverse of formatByDecimals.
 *
 * @param amount - The human-readable amount as a string (e.g., "1.5")
 * @param decimals - The number of decimal places for the token
 * @returns The amount in smallest units as a bigint
 * @throws Error if amount has too many decimal places
 *
 * @example
 * toSmallestUnit("1", 9) // Returns 1000000000n
 * toSmallestUnit("1.5", 9) // Returns 1500000000n
 * toSmallestUnit("0.000000001", 9) // Returns 1n
 * toSmallestUnit(".5", 9) // Returns 500000000n
 */
export function toSmallestUnit(amount: string, decimals: number): bigint {
  if (!amount || amount === ".") return 0n;

  const [whole = "0", fraction = ""] = amount.split(".");

  if (fraction.length > decimals) {
    throw new Error(
      `Amount has too many decimal places. Maximum allowed is ${decimals}.`,
    );
  }

  const paddedFraction = fraction.padEnd(decimals, "0");
  const combined =
    (whole === "0" || whole === "" ? "" : whole) + paddedFraction;
  return BigInt(combined === "" ? "0" : combined);
}
