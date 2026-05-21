import { Transaction } from '@mysten/sui/transactions'
import { fromBase64, toBase64 } from '@mysten/sui/utils'

/** Matches comma-separated decimal bytes (e.g. "0,0,2,0,32,...") with optional whitespace around commas */
const COMMA_SEPARATED_BYTES = /^\d+(\s*,\s*\d+)*$/

export type ParseTransactionBytesResult = {
  /** Display-ready string for the Json component */
  displayValue: string
  /** Signing-ready transaction string for Transaction.from() - base64 for bytes, JSON for objects, trimmed/normalized for strings */
  transactionForSigning?: string
}

async function bytesToDisplayJson(bytes: Uint8Array): Promise<string> {
  const tx = Transaction.from(bytes)
  const json = await tx.toJSON()
  const parsed = (typeof json === 'string' ? JSON.parse(json) : json) as Record<
    string,
    unknown
  >
  return JSON.stringify(parsed, null, 2)
}

/**
 * Returns a display-ready string and signing-ready transaction from pending storage.
 * Accepts the raw value (string or object from chrome.storage).
 * - If object: serializes to JSON for display and returns JSON string for signing (Transaction.from() accepts it)
 * - If comma-separated bytes: parses to human-readable JSON and base64 for signing
 * - If base64: parses to human-readable JSON for display, normalized base64 for signing
 * - Otherwise: returns the normalized string
 */
export async function parseTransactionBytes(
  transaction: string | Record<string, unknown>,
): Promise<ParseTransactionBytesResult> {
  // Handle object input (e.g., Transaction.toJSON() result)
  if (typeof transaction !== 'string') {
    const jsonString = JSON.stringify(transaction)
    const displayValue = JSON.stringify(transaction, null, 2)

    // Transaction.from() can accept serialized transaction objects as JSON strings
    // Return the compact JSON string for signing
    return {
      displayValue,
      transactionForSigning: jsonString,
    }
  }

  const str = transaction
  const trimmed = str.trim()

  if (COMMA_SEPARATED_BYTES.test(trimmed)) {
    try {
      // Parse each byte and validate range
      const parsedBytes = trimmed.split(',').map((s) => {
        const num = Number(s.trim())
        // Validate that the value is a finite integer in the 0-255 range
        if (
          !Number.isFinite(num) ||
          !Number.isInteger(num) ||
          num < 0 ||
          num > 255
        ) {
          throw new Error(`Invalid byte value: ${s.trim()}`)
        }
        return num
      })
      const bytes = new Uint8Array(parsedBytes)
      const displayValue = await bytesToDisplayJson(bytes)
      return {
        displayValue,
        transactionForSigning: toBase64(bytes),
      }
    } catch {
      return { displayValue: str }
    }
  }

  try {
    const bytes = fromBase64(trimmed)
    const displayValue = await bytesToDisplayJson(bytes)
    // Return normalized (trimmed) base64 for signing to prevent whitespace issues
    return { displayValue, transactionForSigning: trimmed }
  } catch {
    return { displayValue: str }
  }
}
