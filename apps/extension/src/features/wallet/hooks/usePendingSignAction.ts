import { createLogger } from '@evevault/shared/utils'
import { useEffect, useState } from 'react'
import { useSignPopupAuth } from './useSignPopupAuth'

const log = createLogger()

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

export function usePendingSignAction<TPending>({
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
  // per-request id so the background can bind the result to its originating
  // request (NEW-E). All result writers must go through here.
  const storeResult = async (
    result: Record<string, unknown>,
    targetPending = pending,
  ) => {
    if (!targetPending) return

    await chrome.storage.local.set({
      transactionResult: {
        ...result,
        windowId: getWindowId(targetPending),
        requestId: (targetPending as { requestId?: string }).requestId,
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
