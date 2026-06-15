const DEFAULT_ERROR_MESSAGE = 'Unknown error'
const OBJECT_OBJECT_MESSAGE = '[object Object]'

function cleanMessage(value: string): string | null {
  const message = value.trim()
  if (!message || message === OBJECT_OBJECT_MESSAGE) return null
  return message
}

function readErrorMessage(error: unknown): string | null {
  if (error instanceof Error) return cleanMessage(error.message)
  if (typeof error === 'string') return cleanMessage(error)
  if (
    typeof error === 'number' ||
    typeof error === 'boolean' ||
    typeof error === 'bigint'
  ) {
    return String(error)
  }

  if (!error || typeof error !== 'object') return null

  const record = error as Record<string, unknown>
  return readErrorMessage(record.message) ?? readErrorMessage(record.error)
}

export function toErrorMessage(
  error: unknown,
  fallback = DEFAULT_ERROR_MESSAGE,
): string {
  return readErrorMessage(error) ?? fallback
}
