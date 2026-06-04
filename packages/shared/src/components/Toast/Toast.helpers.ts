import type React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ToastVariant } from '#/types'

const EXIT_DELAY_MS = 300

type TimerRef = React.MutableRefObject<ReturnType<typeof setTimeout> | null>

function clearTimer(timerRef: TimerRef) {
  if (timerRef.current == null) return
  clearTimeout(timerRef.current)
  timerRef.current = null
}

function clearTimers(timerRefs: TimerRef[]) {
  timerRefs.forEach(clearTimer)
}

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

export function getToastA11yProps(variant: ToastVariant) {
  const isError = variant === 'error'

  return {
    'aria-live': isError ? 'assertive' : 'polite',
    role: isError ? 'alert' : 'status',
  } as const
}

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
