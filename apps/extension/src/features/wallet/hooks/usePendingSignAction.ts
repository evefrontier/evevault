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
    browser.storage.local
      .get('pendingAction')
      .then(async (data) => {
        const pendingAction = data.pendingAction
        if (!pendingAction) {
          setError(missingError)
          return
        }

        try {
          setPending(await parsePending(pendingAction))
        } catch (err) {
          setError(errorMessageFrom(err))
        }
      })
      .catch((err) => {
        setError(errorMessageFrom(err))
      })
  }, [missingError, parsePending])

  // Writes the popup's result to storage, always stamping the windowId and the
  // per-request id so the background can bind the result to the request that
  // opened this popup. All result writers must go through here.
  const storeResult = async (
    result: PopupResultPayload,
    targetPending = pending,
  ): Promise<boolean> => {
    if (!targetPending) return false

    const { requestId } = targetPending
    if (!requestId) {
      // The background drops any result whose requestId doesn't match the
      // request, so writing one without a requestId would leave the request
      // hanging forever with no error. Fail loud instead of failing silently.
      log.error(
        'Refusing to store sign result: pending action has no requestId',
      )
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

  const storeErrorResult = async (
    errorMessage: string,
    targetPending = pending,
  ): Promise<boolean> => {
    return storeResult({ status: 'error', error: errorMessage }, targetPending)
  }

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
        return
      }
      setError(rejectFailureError)
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
