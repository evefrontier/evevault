import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '#/components/Icon';
import type { ToastProps } from '#/types';
import './Toast.css';

const EXIT_DELAY_MS = 300;

export const Toast: React.FC<ToastProps> = ({
  title,
  message,
  isVisible,
  onClose,
  duration = 3000,
  variant = 'default',
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const autoDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleExit = useCallback(() => {
    if (exitTimerRef.current != null) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
    exitTimerRef.current = setTimeout(() => {
      exitTimerRef.current = null;
      onClose();
    }, EXIT_DELAY_MS);
  }, [onClose]);

  const handleClose = () => {
    if (autoDismissTimerRef.current != null) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }
    if (exitTimerRef.current != null) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
    setIsAnimating(false);
    scheduleExit();
  };

  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true);
      autoDismissTimerRef.current = setTimeout(() => {
        autoDismissTimerRef.current = null;
        setIsAnimating(false);
        scheduleExit();
      }, duration);

      return () => {
        if (autoDismissTimerRef.current != null) {
          clearTimeout(autoDismissTimerRef.current);
          autoDismissTimerRef.current = null;
        }
        if (exitTimerRef.current != null) {
          clearTimeout(exitTimerRef.current);
          exitTimerRef.current = null;
        }
      };
    }
  }, [isVisible, duration, scheduleExit]);

  if (!isVisible && !isAnimating) return null;

  const hostVisibility = isAnimating
    ? 'toast-host--visible'
    : 'toast-host--hidden';
  const isError = variant === 'error';
  const shellMod = isError ? 'toast-shell--error' : 'toast-shell--default';
  const showMessage = Boolean(message?.trim());

  return (
    <div
      className={`toast-host ${hostVisibility}`}
      data-name="Toast"
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
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
  );
};

export default Toast;
