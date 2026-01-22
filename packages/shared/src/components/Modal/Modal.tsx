import type React from "react";
import { useEffect, useRef } from "react";
import Button from "../Button";
import Text from "../Text";
import "./Modal.css";
import Heading from "../Heading";

export type ModalSize = "small" | "medium" | "large" | "full";

export interface ModalProps {
  isOpen: boolean;
  onClose?: () => void;
  title?: string;
  message?: React.ReactNode;
  children?: React.ReactNode;
  primaryAction?: {
    label: string;
    onClick: () => void;
    isLoading?: boolean;
    disabled?: boolean;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
  className?: string;
  closeOnOverlayClick?: boolean;
  /** Modal width: small (400px), medium (600px), large (800px), full (90vw) */
  size?: ModalSize;
  fullWidthActions?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  children,
  primaryAction,
  secondaryAction,
  className = "",
  closeOnOverlayClick = true,
  size = "small",
  fullWidthActions = false,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen || !onClose) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOverlayClick = (event: React.MouseEvent) => {
    if (
      closeOnOverlayClick &&
      onClose &&
      event.target === event.currentTarget
    ) {
      onClose();
    }
  };

  const hasActions = primaryAction || secondaryAction;
  const sizeClass = `modal--${size}`;
  const actionsClass = fullWidthActions ? "modal__actions--full" : "";

  return (
    <div
      className="modal__overlay"
      onClick={handleOverlayClick}
      onKeyDown={(e) => e.key === "Escape" && onClose?.()}
      role="dialog"
      aria-modal="true"
    >
      <div className={`modal ${sizeClass} ${className}`} ref={modalRef}>
        <div className="modal__content">
          {title && (
            <Heading level={2} variant="bold" color="neutral">
              {title}
            </Heading>
          )}

          {children || (message && <Text color="grey-neutral">{message}</Text>)}

          {hasActions && (
            <div className={`modal__actions ${actionsClass}`}>
              {secondaryAction && (
                <Button
                  variant="secondary"
                  size={fullWidthActions ? "fill" : "medium"}
                  onClick={secondaryAction.onClick}
                  disabled={secondaryAction.disabled}
                >
                  {secondaryAction.label}
                </Button>
              )}
              {primaryAction && (
                <Button
                  variant="primary"
                  size={fullWidthActions ? "fill" : "medium"}
                  onClick={primaryAction.onClick}
                  isLoading={primaryAction.isLoading}
                  disabled={primaryAction.disabled}
                >
                  {primaryAction.label}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Modal;
