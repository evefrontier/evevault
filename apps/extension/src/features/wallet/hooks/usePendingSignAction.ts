import { createLogger } from '@evevault/shared/utils'
import { useEffect, useState } from 'react'
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

export type StoreResult = (result: PopupResultPayload) => Promise<void>

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
    chrome.storage.local
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
  ) => {
    if (!targetPending) return

    const { requestId } = targetPending
    if (!requestId) {
      // The background drops any result whose requestId doesn't match the
      // request, so writing one without a requestId would leave the request
      // hanging forever with no error. Fail loud instead of failing silently.
      log.error(
        'Refusing to store sign result: pending action has no requestId',
      )
      return
    }

    await chrome.storage.local.set({
      transactionResult: {
        ...result,
        windowId: getWindowId(targetPending),
        requestId,
      },
    })
  }

  const storeErrorResult = async (
    errorMessage: string,
    targetPending = pending,
  ) => {
    await storeResult({ status: 'error', error: errorMessage }, targetPending)
  }

  const handleReject = async () => {
    if (!pending) return

    try {
      await storeErrorResult(rejectError, pending)
      window.close()
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
    storeResult,
    storeErrorResult,
  }
}
