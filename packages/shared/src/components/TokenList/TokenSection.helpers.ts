import type { SuiChain } from '@mysten/wallet-standard'
import type { QueryClient } from '@tanstack/react-query'
import type React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useContext } from '#/hooks'
import { getDefaultTokensForChain } from '#/types/networks'
import { createLogger } from '#/utils'
import { getEveCoinType, isEveCoinType } from '#/wallet/eveToken'

const SCRAMBLE_INTERVAL_MS = 200
const REFRESH_TIMEOUT_MS = 10000

const log = createLogger()

/**
 * Clears the refresh scramble interval in one place because it is stopped by
 * normal completion, timeout completion, and component unmount.
 */
function clearTimer(
  timerRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>,
) {
  if (timerRef.current == null) return
  clearInterval(timerRef.current)
  timerRef.current = null
}

/**
 * Refetches balances and transactions together so the token list and recent
 * activity stay in sync after a manual refresh.
 */
async function refetchBalancesAndTransactions(queryClient: QueryClient) {
  await Promise.all([
    queryClient.refetchQueries({
      queryKey: ['coin-balance'],
      type: 'all',
    }),
    queryClient.refetchQueries({
      queryKey: ['transactions'],
      type: 'all',
    }),
  ])
}

/**
 * Caps manual refresh duration because some wallet queries can hang behind
 * extension or localnet RPC boundaries.
 */
function createTimeoutPromise() {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  const timeoutPromise = new Promise<void>((resolve) => {
    timeoutId = setTimeout(resolve, REFRESH_TIMEOUT_MS)
  })

  return {
    clear: () => {
      if (timeoutId != null) clearTimeout(timeoutId)
    },
    promise: timeoutPromise,
  }
}

/**
 * Coordinates the balance refresh request with the scramble animation and
 * timeout fallback used by the compact token list UI.
 */
export function useRefreshBalances(
  queryClient: QueryClient,
  showToast: (message: string) => void,
) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)
  const scrambleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  )

  useEffect(() => () => clearTimer(scrambleIntervalRef), [])

  const startRefreshAnimation = useCallback(() => {
    clearTimer(scrambleIntervalRef)
    setIsRefreshing(true)
    setRefreshTick(0)
    scrambleIntervalRef.current = setInterval(() => {
      setRefreshTick((tick) => tick + 1)
    }, SCRAMBLE_INTERVAL_MS)
  }, [])

  const stopRefreshAnimation = useCallback(() => {
    clearTimer(scrambleIntervalRef)
    setIsRefreshing(false)
  }, [])

  const refreshBalances = useCallback(async () => {
    if (isRefreshing) return

    startRefreshAnimation()
    const timeout = createTimeoutPromise()

    try {
      await Promise.race([
        refetchBalancesAndTransactions(queryClient),
        timeout.promise,
      ])
    } catch (error) {
      log.error('Refresh balances failed', error)
      showToast('Failed to refresh balances')
    } finally {
      timeout.clear()
      stopRefreshAnimation()
    }
  }, [
    isRefreshing,
    queryClient,
    showToast,
    startRefreshAnimation,
    stopRefreshAnimation,
  ])

  return { isRefreshing, refreshBalances, refreshTick }
}

/**
 * Rewrites tenant-scoped EVE coin aliases after reading persisted tokens so
 * stored token lists remain portable across tenants.
 */
export function useTokensForChain(
  chain: SuiChain | null,
  tokens: Partial<Record<SuiChain, string[]>>,
): string[] {
  const { tenantId } = useContext()
  const currentEveCoinType = getEveCoinType(tenantId)

  return useMemo(() => {
    if (!chain) return []

    const stored = tokens[chain] ?? getDefaultTokensForChain(chain, tenantId)
    const mapped = stored.map((token) =>
      isEveCoinType(token) ? currentEveCoinType : token,
    )

    return [...new Set(mapped)]
  }, [chain, tokens, tenantId, currentEveCoinType])
}

/**
 * Wraps clipboard access so callers only handle toast messaging, while browser
 * capability failures still produce a user-visible result.
 */
export function useCopyAddress(showToast: (message: string) => void) {
  return useCallback(
    async (address: string) => {
      try {
        if (typeof navigator === 'undefined' || !navigator.clipboard) {
          throw new Error('Clipboard unavailable')
        }
        await navigator.clipboard.writeText(address)
        showToast('Copied!')
      } catch (_error) {
        showToast('Copy failed')
      }
    },
    [showToast],
  )
}

/**
 * Clears selection after removing a token to avoid leaving action controls
 * attached to a coin that is no longer in the visible list.
 */
export function removeSelectedToken({
  chain,
  removeToken,
  selectedToken,
  setSelectedToken,
}: {
  chain: SuiChain | null
  removeToken: (chain: SuiChain, coinType: string) => void
  selectedToken: string | null
  setSelectedToken: (coinType: string | null) => void
}) {
  if (!selectedToken || !chain) return

  removeToken(chain, selectedToken)
  setSelectedToken(null)
}
