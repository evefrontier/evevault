import { Transaction } from '@mysten/sui/transactions'
import { fromBase64, toBase64 } from '@mysten/sui/utils'

/** Matches comma-separated decimal bytes (e.g. "0,0,2,0,32,...") with optional whitespace around commas */
const COMMA_SEPARATED_BYTES = /^\d+(\s*,\s*\d+)*$/

export type ParseTransactionBytesResult = {
  /** Display-ready string for the Json component */
  displayValue: string
  /** Parsed transaction-like value for review logic. Display formatting must not affect this. */
  reviewValue?: unknown
  /** Signing-ready transaction string for Transaction.from() - base64 for bytes, JSON for objects, trimmed/normalized for strings */
  transactionForSigning?: string
}

async function bytesToReviewValue(bytes: Uint8Array): Promise<unknown> {
  const tx = Transaction.from(bytes)
  const json = await tx.toJSON()
  return typeof json === 'string' ? JSON.parse(json) : json
}

function parseJsonString(value: string): { ok: true; value: unknown } | null {
  try {
    return { ok: true, value: JSON.parse(value) }
  } catch {
    return null
  }
}

function toDisplayResult(
  reviewValue: unknown,
  transactionForSigning?: string,
): ParseTransactionBytesResult {
  return {
    displayValue: JSON.stringify(reviewValue, null, 2),
    reviewValue,
    ...(transactionForSigning && { transactionForSigning }),
  }
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
): ParseTransactionBytesResult =>
  toDisplayResult(
    transaction,
    // Transaction.from() can accept serialized transaction objects as JSON strings.
    JSON.stringify(transaction),
  )

const parseTransactionString = async (
  transaction: string,
): Promise<ParseTransactionBytesResult> => {
  const trimmed = transaction.trim()
  const parser = COMMA_SEPARATED_BYTES.test(trimmed)
    ? parseCommaSeparatedBytes
    : parseBase64Bytes

  const result = await parser(trimmed, transaction)
  if (result.transactionForSigning || result.reviewValue !== undefined) {
    return result
  }

  const parsed = parseJsonString(transaction)
  return parsed ? { ...result, reviewValue: parsed.value } : result
}

const parseCommaSeparatedBytes = async (
  trimmed: string,
  original: string,
): Promise<ParseTransactionBytesResult> => {
  try {
    const bytes = new Uint8Array(trimmed.split(',').map(parseByteValue))
    return toDisplayResult(await bytesToReviewValue(bytes), toBase64(bytes))
  } catch {
    return { displayValue: original }
  }
}

const parseBase64Bytes = async (
  trimmed: string,
  original: string,
): Promise<ParseTransactionBytesResult> => {
  try {
    return toDisplayResult(
      await bytesToReviewValue(fromBase64(trimmed)),
      trimmed,
    )
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
