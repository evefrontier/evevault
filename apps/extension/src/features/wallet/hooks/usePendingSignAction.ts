import { isKeeperLockedError } from '@evevault/shared'
import { createLogger } from '@evevault/shared/utils'
import { useEffect, useState } from 'react'
import { browser } from 'wxt/browser'
import { useSignPopupAuth } from './useSignPopupAuth'

const log = createLogger()

/**
 * The shapes a popup may write as its result. `storeResult` stamps `windowId`
 * and `requestId` on top of these, so call sites never spell those out — and a
 * typo'd `status` or a missing field is now a compile error rather than a value
 * the background silently fails to recognize.
 */
export type PopupResultPayload =
  | { status: 'signed'; bytes: string; signature: string }
  | { status: 'signed'; zkSignature: string; preparationId: string }
  | {
      status: 'signed_and_executed'
      bytes: string
      signature: string
      digest: string
      effects: string
    }
  | { status: 'error'; error: string }

/** Resolves true when the result was written, false when it was refused. */
export type StoreResult = (result: PopupResultPayload) => Promise<boolean>

type PendingParser<TPending> = (
  pendingAction: unknown,
) => TPending | Promise<TPending>

type UsePendingSignActionOptions<TPending> = {
  parsePending: PendingParser<TPending>
  missingError: string
  rejectError: string
  rejectFailureError: string
  rejectLogMessage: string
  getWindowId: (pending: TPending) => number
}

function errorMessageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error occurred'
}

// Reads and parses the popup's pending action; rejects when there is none.
async function loadPendingAction<TPending>(
  parsePending: PendingParser<TPending>,
  missingError: string,
): Promise<TPending> {
  const { pendingAction } = await browser.storage.local.get('pendingAction')
  if (!pendingAction) throw new Error(missingError)
  return parsePending(pendingAction)
}

// Writes the popup's result to storage, always stamping the windowId and the
// per-request id so the background can bind the result to the request that
// opened this popup.
async function writePopupResult<TPending extends { requestId?: string }>(
  result: PopupResultPayload,
  targetPending: TPending | null,
  getWindowId: (pending: TPending) => number,
): Promise<boolean> {
  if (!targetPending) return false

  const { requestId } = targetPending
  if (!requestId) {
    // The background drops any result whose requestId doesn't match the
    // request, so writing one without a requestId would leave the request
    // hanging forever with no error. Fail loud instead of failing silently.
    log.error('Refusing to store sign result: pending action has no requestId')
    return false
  }

  await browser.storage.local.set({
    transactionResult: {
      ...result,
      windowId: getWindowId(targetPending),
      requestId,
    },
  })
  return true
}

export function usePendingSignAction<TPending extends { requestId?: string }>({
  parsePending,
  missingError,
  rejectError,
  rejectFailureError,
  rejectLogMessage,
  getWindowId,
}: UsePendingSignActionOptions<TPending>) {
  const [pending, setPending] = useState<TPending | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const auth = useSignPopupAuth()

  useEffect(() => {
    loadPendingAction(parsePending, missingError)
      .then(setPending)
      .catch((err) => {
        setError(errorMessageFrom(err))
      })
  }, [missingError, parsePending])

  // All result writers must go through here.
  const storeResult = (
    result: PopupResultPayload,
    targetPending = pending,
  ): Promise<boolean> => writePopupResult(result, targetPending, getWindowId)

  const storeErrorResult = (
    errorMessage: string,
    targetPending = pending,
  ): Promise<boolean> =>
    storeResult({ status: 'error', error: errorMessage }, targetPending)

  // If a sign attempt reaches the keeper after its unlock window expired, flip
  // this popup to the lock screen and keep the request pending instead of
  // failing the dApp. The same request continues to approval after unlock.
  // Returns true when the error was the recoverable locked-vault signal.
  const recoverIfLocked = async (errorMessage: string): Promise<boolean> => {
    if (!isKeeperLockedError(errorMessage)) return false
    log.info('Sign request hit locked keeper; showing unlock screen for retry')
    setError(null)
    await auth.lock()
    return true
  }

  const handleReject = async () => {
    if (!pending) return

    try {
      // Only close once the rejection is actually recorded; closing on a
      // refused write would leave the dApp request hanging with no response.
      if (await storeErrorResult(rejectError, pending)) {
        window.close()
      } else {
        setError(rejectFailureError)
      }
    } catch (err) {
      log.error(rejectLogMessage, err)
      setError(rejectFailureError)
    }
  }

  return {
    pending,
    loading,
    setLoading,
    error,
    setError,
    auth,
    handleReject,
    recoverIfLocked,
    storeResult,
    storeErrorResult,
  }
}
