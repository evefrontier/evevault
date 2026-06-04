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
  return typeof transaction === 'string'
    ? parseTransactionString(transaction)
    : parseTransactionObject(transaction)
}

const parseTransactionObject = (
  transaction: Record<string, unknown>,
): ParseTransactionBytesResult => ({
  displayValue: JSON.stringify(transaction, null, 2),
  // Transaction.from() can accept serialized transaction objects as JSON strings.
  transactionForSigning: JSON.stringify(transaction),
})

const parseTransactionString = async (
  transaction: string,
): Promise<ParseTransactionBytesResult> => {
  const trimmed = transaction.trim()
  const parser = COMMA_SEPARATED_BYTES.test(trimmed)
    ? parseCommaSeparatedBytes
    : parseBase64Bytes

  return parser(trimmed, transaction)
}

const parseCommaSeparatedBytes = async (
  trimmed: string,
  original: string,
): Promise<ParseTransactionBytesResult> => {
  try {
    const bytes = new Uint8Array(trimmed.split(',').map(parseByteValue))
    return {
      displayValue: await bytesToDisplayJson(bytes),
      transactionForSigning: toBase64(bytes),
    }
  } catch {
    return { displayValue: original }
  }
}

const parseBase64Bytes = async (
  trimmed: string,
  original: string,
): Promise<ParseTransactionBytesResult> => {
  try {
    return {
      displayValue: await bytesToDisplayJson(fromBase64(trimmed)),
      transactionForSigning: trimmed,
    }
  } catch {
    return { displayValue: original }
  }
}

const parseByteValue = (value: string): number => {
  const trimmed = value.trim()
  const num = Number(trimmed)
  if (!Number.isFinite(num) || !Number.isInteger(num) || num < 0 || num > 255) {
    throw new Error(`Invalid byte value: ${trimmed}`)
  }
  return num
}
