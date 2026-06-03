import type { QueryClient } from '@tanstack/react-query'
import type { MutableRefObject } from 'react'
import { useCallback, useEffect, useRef } from 'react'

const BALANCE_REFETCH_DELAY_MS = 2000
const TRANSFER_QUERY_KEYS = [['coin-balance'], ['transactions']] as const

export const refetchTransferQueries = (queryClient: QueryClient) => {
  TRANSFER_QUERY_KEYS.forEach((queryKey) => {
    queryClient.invalidateQueries({ queryKey })
  })

  void Promise.all(
    TRANSFER_QUERY_KEYS.map((queryKey) =>
      queryClient.refetchQueries({ queryKey, type: 'all' }),
    ),
  )
}

export const useDelayedTransferRefetch = (queryClient: QueryClient) => {
  const postTransferRefetchTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null)

  useEffect(() => {
    return () => clearRefetchTimer(postTransferRefetchTimerRef)
  }, [])

  return useCallback(() => {
    clearRefetchTimer(postTransferRefetchTimerRef)
    postTransferRefetchTimerRef.current = setTimeout(() => {
      postTransferRefetchTimerRef.current = null
      refetchQueriesOnly(queryClient)
    }, BALANCE_REFETCH_DELAY_MS)
  }, [queryClient])
}

const refetchQueriesOnly = (queryClient: QueryClient) => {
  TRANSFER_QUERY_KEYS.forEach((queryKey) => {
    void queryClient.refetchQueries({ queryKey, type: 'all' })
  })
}

const clearRefetchTimer = (
  ref: MutableRefObject<ReturnType<typeof setTimeout> | null>,
) => {
  if (ref.current != null) {
    clearTimeout(ref.current)
    ref.current = null
  }
}
