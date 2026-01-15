import type React from "react";
import { useEffect, useState } from "react";
import type { ToastProps } from "../../types";

export const Toast: React.FC<ToastProps> = ({
  message,
  isVisible,
  onClose,
  duration = 3000,
}) => {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setIsAnimating(false);
        setTimeout(onClose, 300);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  if (!isVisible && !isAnimating) return null;

  const visibilityClass = isAnimating
    ? "opacity-100 translate-y-0"
    : "opacity-0 -translate-y-5";

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
