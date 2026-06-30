import { useEffect } from 'react'
import { ephKeyService } from '#/services/vaultService'
import { useDeviceStore } from '#/stores/deviceStore'

/**
 * Locks the vault a fixed VAULT_UNLOCK_MS after unlock, regardless of
 * activity. Mount once, high in the app tree (web `__root`,
 * extension `PopupApp`).
 *
 * Re-arms whenever the vault is (re)unlocked and whenever the tab/popup regains
 * visibility, so a timer that was throttled while hidden — or an expiry that
 * elapsed while the app was backgrounded — still locks promptly on return.
 *
 * Web is fully self-contained: the vault lives in the page context, so locking
 * here is the lock. On the extension this drives the UI to the lock screen
 * while the popup is open; the offscreen keeper locks itself independently
 * (see keeperState) for the case where no popup is open.
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
        void lock()
        return
      }
      // Re-arm on fire rather than locking blindly, so a timer that fired
      // early (clock drift / throttling) re-checks against the real expiry.
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
