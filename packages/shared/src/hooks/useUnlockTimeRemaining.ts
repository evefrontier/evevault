import { useEffect, useState } from 'react'
import { ephKeyService } from '#/services/vaultService'
import { isWeb } from '#/utils/environment'

/** Formats milliseconds as m:ss (e.g. 503000 -> "8:23"). */
const formatMmSs = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Live countdown of the vault unlock window, shown in the dev-mode dropdown.
 * Returns a `m:ss` label while a window is active, or null when there is
 * nothing to show (locked / disabled). `enabled` gates the polling so it only
 * runs when the readout is actually visible (dev mode on).
 *
 * - Web: the session is in-process, so we read it each tick (reflects
 *   unlock/extend/lock immediately).
 * - Extension: the session lives behind the offscreen keeper, so we query it
 *   once and count down locally from a fixed anchor. The popup remounts every
 *   time it opens, which re-syncs the anchor — so we avoid pinging the keeper
 *   every second.
 *
 * Display only — actually locking the vault on expiry is owned by
 * useVaultAutoLock.
 */
export const useUnlockTimeRemaining = (enabled: boolean): string | null => {
  const [remainingMs, setRemainingMs] = useState(0)

  useEffect(() => {
    if (!enabled) {
      setRemainingMs(0)
      return
    }

    let cancelled = false
    const apply = (ms: number) => {
      if (!cancelled) setRemainingMs(ms)
    }

    if (isWeb()) {
      const tick = async () => apply(await ephKeyService.getUnlockRemainingMs())
      void tick()
      const id = setInterval(() => void tick(), 1000)
      return () => {
        cancelled = true
        clearInterval(id)
      }
    }

    // Extension: fetch once, then count down locally from the anchor.
    let anchorExpiry: number | null = null
    void ephKeyService.getUnlockRemainingMs().then((ms) => {
      anchorExpiry = ms > 0 ? Date.now() + ms : null
      apply(ms)
    })
    const id = setInterval(() => {
      if (anchorExpiry !== null) {
        apply(Math.max(0, anchorExpiry - Date.now()))
      }
    }, 1000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [enabled])

  return remainingMs > 0 ? formatMmSs(remainingMs) : null
}
