import type React from 'react'
import Icon from '#/components/Icon'
import type { ToastProps } from '#/types'
import './Toast.css'
import {
  getToastA11yProps,
  getToastClassNames,
  useToastLifecycle,
} from './Toast.helpers'

export const Toast: React.FC<ToastProps> = ({
  title,
  message,
  isVisible,
  onClose,
  duration = 3000,
  variant = 'default',
}) => {
  const { handleClose, isAnimating } = useToastLifecycle({
    duration,
    isVisible,
    onClose,
  })

  if (!isVisible && !isAnimating) return null

  const { hostVisibility, shellMod } = getToastClassNames({
    isAnimating,
    variant,
  })
  const showMessage = Boolean(message?.trim())
  const a11yProps = getToastA11yProps(variant)

  return (
    <div
      className={`toast-host ${hostVisibility}`}
      data-name="Toast"
      {...a11yProps}
    >
      <div className={`toast-shell ${shellMod}`}>
        <div className="toast-shell__accent" data-name="Line" aria-hidden />
        <div className="toast-shell__panel">
          <div className="toast-shell__body">
            <p className="toast-shell__title">{title}</p>
            {showMessage ? (
              <p className="toast-shell__message">{message}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="toast-shell__close"
            aria-label="Close"
          >
            <Icon
              name="Close"
              width={16}
              height={16}
              color="neutral"
              aria-hidden
            />
          </button>
        </div>
      </div>
    </div>
  )
}

export default Toast
