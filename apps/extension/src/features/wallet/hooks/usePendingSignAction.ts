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
    chrome.storage.local.get('pendingAction').then(async (data) => {
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
  }, [missingError, parsePending])

  const storeErrorResult = async (
    errorMessage: string,
    targetPending = pending,
  ) => {
    if (!targetPending) return

    await chrome.storage.local.set({
      transactionResult: {
        windowId: getWindowId(targetPending),
        status: 'error',
        error: errorMessage,
      },
    })
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
    storeErrorResult,
  }
}
