import type React from "react";
import { useEffect, useRef, useState } from "react";
import type { ToastProps } from "../../types";
import Icon from "../Icon";

const EXIT_DELAY_MS = 300;

export const Toast: React.FC<ToastProps> = ({
  message,
  isVisible,
  onClose,
  duration = 3000,
  variant = "default",
  title,
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const autoDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClose = () => {
    if (autoDismissTimerRef.current != null) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }
    setIsAnimating(false);
    setTimeout(onClose, EXIT_DELAY_MS);
  };

  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true);
      autoDismissTimerRef.current = setTimeout(() => {
        autoDismissTimerRef.current = null;
        setIsAnimating(false);
        setTimeout(onClose, EXIT_DELAY_MS);
      }, duration);

      return () => {
        if (autoDismissTimerRef.current != null) {
          clearTimeout(autoDismissTimerRef.current);
          autoDismissTimerRef.current = null;
        }
      };
    }
  }, [isVisible, duration, onClose]);

  if (!isVisible && !isAnimating) return null;

  const visibilityClass = isAnimating
    ? "opacity-100 translate-y-0"
    : "opacity-0 -translate-y-5";

  if (variant === "error") {
    return (
      <div
        className={`fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-row items-stretch w-full max-w-[min(600px,calc(100vw-32px))] transition-all duration-300 ease-in-out ${visibilityClass}`}
        data-name="Toast"
        role="alert"
      >
        <div
          className="w-0.5 shrink-0 bg-[var(--error)]"
          data-name="Line"
          aria-hidden
        />
        <div className="flex flex-1 flex-row items-start gap-2 border border-[var(--neutral-50)] border-l-0 bg-[var(--matter-01)] px-6 py-3">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {title ? (
              <p className="font-bold text-base leading-[1.5] text-[var(--error)] whitespace-nowrap">
                {title}
              </p>
            ) : null}
            <p className="text-base leading-[1.5] text-[var(--neutral-90)] break-words">
              {message}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="shrink-0 rounded p-0.5 opacity-90 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--neutral-50)]"
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
    );
  }

  return (
    <div
      className={`fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-start p-0 transition-all duration-300 ease-in-out ${visibilityClass}`}
    >
      <div className="flex flex-col items-start p-1 border border-[rgba(255,255,214,0.5)]">
        <div className="flex items-center justify-center px-4 py-2 gap-4 bg-[#ffffd6] border border-[rgba(255,255,214,0.3)] max-w-[calc(100vw-32px)]">
          <span className="font-['Bai_Jamjuree'] font-semibold text-base leading-[140%] text-[#130904] break-words">
            {message}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Toast;
