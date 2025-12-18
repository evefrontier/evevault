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
