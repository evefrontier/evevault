import { useCallback, useState } from 'react'
import { createLogger } from '#/utils'

const log = createLogger()

interface RunOptions {
  /** User-facing message shown when the thrown value isn't an `Error`. */
  fallbackMessage: string
  /** Label used for the error log line; defaults to `fallbackMessage`. */
  logLabel?: string
  /**
   * Side-effect after a successful digest (e.g. refetch queries, log success).
   * Awaited before `isSubmitting` clears.
   */
  onSuccess?: (digest: string | null) => void | Promise<void>
}

export interface UseTransactionWriteResult {
  /** True while a write is in flight. */
  isSubmitting: boolean
  /** Last error message, or `null`. */
  error: string | null
  /** Digest of the last successful write, or `null`. */
  txDigest: string | null
  /**
   * Runs a write: resets state, executes, then records the digest (running
   * `onSuccess`) or surfaces the error. Returns the digest, or `null` on
   * failure. Never throws.
   */
  run: (
    execute: () => Promise<string | null>,
    options: RunOptions,
  ) => Promise<string | null>
  /**
   * Surface an error without running a write — for caller-side guards that
   * abort before execution (e.g. failed validation).
   */
  setError: (message: string | null) => void
}

/**
 * Shared write-transaction lifecycle for signing hooks. Owns the
 * `isSubmitting` / `error` / `txDigest` state trio and the reset →
 * try/catch/finally flow that `useSendToken` and `useAliases` would otherwise
 * each duplicate. Pre-execution guards stay in the caller and use `setError`.
 */
export function useTransactionWrite(): UseTransactionWriteResult {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txDigest, setTxDigest] = useState<string | null>(null)

  const run = useCallback(
    async (
      execute: () => Promise<string | null>,
      { fallbackMessage, logLabel, onSuccess }: RunOptions,
    ): Promise<string | null> => {
      setIsSubmitting(true)
      setError(null)
      setTxDigest(null)
      try {
        const digest = await execute()
        setTxDigest(digest)
        await onSuccess?.(digest)
        return digest
      } catch (err) {
        const message = err instanceof Error ? err.message : fallbackMessage
        log.error(logLabel ?? fallbackMessage, err)
        setError(message)
        return null
      } finally {
        setIsSubmitting(false)
      }
    },
    [],
  )

  return { isSubmitting, error, txDigest, run, setError }
}
