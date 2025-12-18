/**
 * Formats a long address to show only the first and last few characters.
 *
 * @param address - The full address string
 * @param prefixLength - Number of characters to show at the start (default: 6)
 * @param suffixLength - Number of characters to show at the end (default: 6)
 * @returns Formatted address string (e.g., "0x1234...5678")
 *
 * @example
 * formatAddress("0x1234567890abcdef") // Returns "0x1234...cdef"
 * formatAddress("0x1234567890abcdef", 4, 4) // Returns "0x12...cdef"
 */
export function formatAddress(
  address: string,
  prefixLength: number = 6,
  suffixLength: number = 6,
): string {
  if (!address || address.length <= prefixLength + suffixLength) {
    return address;
  }

  const prefix = address.slice(0, prefixLength);
  const suffix = address.slice(-suffixLength);

  return `${prefix}•••${suffix}`;
}

/**
 * Copies text to clipboard.
 *
 * @param text - The text to copy
 * @returns Promise that resolves to true if successful, false otherwise
 *
 * @example
 * await copyToClipboard("0x1234567890abcdef")
 */
import { createLogger } from "./logger";

const log = createLogger();

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      throw new Error("Clipboard API not available");
    }
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    log.error("Failed to copy to clipboard", error);
    return false;
  }
}
