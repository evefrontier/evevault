import type React from "react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";
import type { ToastVariant } from "../../types/components";
import { Toast } from "./Toast";

type ToastState = {
  message: string;
  isVisible: boolean;
  duration: number;
  variant: ToastVariant;
  title?: string;
};

interface ToastContextType {
  showToast: (message: string, duration?: number) => void;
  showErrorToast: (message: string, title?: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

interface ToastProviderProps {
  children: ReactNode;
}

const initialToastState: ToastState = {
  message: "",
  isVisible: false,
  duration: 3000,
  variant: "default",
};

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toast, setToast] = useState<ToastState>(initialToastState);

  const showToast = useCallback((message: string, duration = 3000) => {
    setToast({
      message,
      isVisible: true,
      duration,
      variant: "default",
    });
  }, []);

  const showErrorToast = useCallback(
    (message: string, title?: string, duration = 5000) => {
      setToast({
        message,
        isVisible: true,
        duration,
        variant: "error",
        title,
      });
    },
    [],
  );

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, isVisible: false }));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, showErrorToast }}>
      {children}
      <Toast
        message={toast.message}
        isVisible={toast.isVisible}
        onClose={hideToast}
        duration={toast.duration}
        variant={toast.variant}
        title={toast.title}
      />
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};
