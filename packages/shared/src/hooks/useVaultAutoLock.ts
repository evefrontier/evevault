import { useEffect } from 'react'
import { ephKeyService } from '#/services/vaultService'
import { useDeviceStore } from '#/stores/deviceStore'
import { createLogger } from '#/utils/logger'

const log = createLogger()

/**
 * Locks the vault a fixed VAULT_UNLOCK_MS after unlock.
 * Re-arms on re-unlock and on tab/popup visibility, so a throttled
 * or slept timer still locks promptly on return.
 *
 * Mount once per app (web `__root`, extension `PopupApp`) — there's no registry,
 * so a new entrypoint that forgets it silently loses auto-lock.
 *
 * On the extension this only locks the UI while the popup is open; the keeper
 * locks itself for the no-popup case (keeperState). Keep both in step — they
 * share the VAULT_UNLOCK_MS window.
 */
export const useVaultAutoLock = (): void => {
  const isLocked = useDeviceStore((s) => s.isLocked)
  const lock = useDeviceStore((s) => s.lock)

  useEffect(() => {
    if (isLocked) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const clearTimer = () => {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
    }

    const arm = async () => {
      const remaining = await ephKeyService.getUnlockRemainingMs()
      if (cancelled) return
      clearTimer()
      if (remaining <= 0) {
        // Surface a failed lock rather than swallowing it — this is a security
        // control, so a silent failure is the dangerous case.
        lock().catch((error) => log.error('[auto-lock] failed to lock', error))
        return
      }
      // Re-check on fire (not lock blindly) — guards against an early timer.
      timer = setTimeout(() => void arm(), remaining)
    }

    void arm()

    const onVisible = () => {
      if (document.visibilityState === 'visible') void arm()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      clearTimer()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [isLocked, lock])
}
