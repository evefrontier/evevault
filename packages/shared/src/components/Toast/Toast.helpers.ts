import type React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ToastVariant } from '#/types'

type TimerRef = React.MutableRefObject<ReturnType<typeof setTimeout> | null>

const EXIT_DELAY_MS = 300

/**
 * Clears a timer ref in place so repeated close paths can safely share cleanup
 * without leaving stale timeout handles behind.
 */
function clearTimer(timerRef: TimerRef) {
  if (timerRef.current == null) return
  clearTimeout(timerRef.current)
  timerRef.current = null
}

/**
 * Keeps paired auto-dismiss and exit-animation timers synchronized during
 * unmounts, manual close, and visibility changes.
 */
function clearTimers(timerRefs: TimerRef[]) {
  timerRefs.forEach(clearTimer)
}

/**
 * Separates toast visibility from exit animation so callers can remove the
 * toast only after the CSS transition has had time to finish.
 */
export function useToastLifecycle({
  duration,
  isVisible,
  onClose,
}: {
  duration: number
  isVisible: boolean
  onClose: () => void
}) {
  const [isAnimating, setIsAnimating] = useState(false)
  const autoDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleClose = useCallback(() => {
    clearTimers([autoDismissTimerRef, exitTimerRef])
    setIsAnimating(false)
    exitTimerRef.current = setTimeout(() => {
      exitTimerRef.current = null
      onClose()
    }, EXIT_DELAY_MS)
  }, [onClose])

  useEffect(() => {
    if (!isVisible) return

    setIsAnimating(true)
    autoDismissTimerRef.current = setTimeout(() => {
      autoDismissTimerRef.current = null
      setIsAnimating(false)
      clearTimer(exitTimerRef)
      exitTimerRef.current = setTimeout(() => {
        exitTimerRef.current = null
        onClose()
      }, EXIT_DELAY_MS)
    }, duration)

    return () => clearTimers([autoDismissTimerRef, exitTimerRef])
  }, [isVisible, duration, onClose])

  return { handleClose, isAnimating }
}

/**
 * Maps visual severity to screen-reader behavior so error toasts interrupt
 * politely rendered default notifications.
 */
export function getToastA11yProps(variant: ToastVariant) {
  const isError = variant === 'error'

  return {
    'aria-live': isError ? 'assertive' : 'polite',
    role: isError ? 'alert' : 'status',
  } as const
}

/**
 * Keeps the CSS module names centralized because the toast has parallel host
 * and shell animation states.
 */
export function getToastClassNames({
  isAnimating,
  variant,
}: {
  isAnimating: boolean
  variant: ToastVariant
}) {
  return {
    hostVisibility: isAnimating ? 'toast-host--visible' : 'toast-host--hidden',
    shellMod:
      variant === 'error' ? 'toast-shell--error' : 'toast-shell--default',
  }
}
