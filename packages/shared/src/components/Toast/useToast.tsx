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
  title: string;
  message?: string;
  isVisible: boolean;
  duration: number;
  variant: ToastVariant;
};

function parseToastArgs(
  title: string,
  defaultDuration: number,
  messageOrDuration?: string | number,
  duration?: number,
): Pick<ToastState, "title" | "message" | "duration"> {
  if (typeof messageOrDuration === "number") {
    return { title, message: undefined, duration: messageOrDuration };
  }
  if (messageOrDuration !== undefined) {
    return {
      title,
      message: messageOrDuration,
      duration: duration ?? defaultDuration,
    };
  }
  return { title, message: undefined, duration: duration ?? defaultDuration };
}

interface ToastContextType {
  showToast: {
    (title: string, duration?: number): void;
    (title: string, message: string, duration?: number): void;
  };
  showErrorToast: {
    (title: string, duration?: number): void;
    (title: string, message: string, duration?: number): void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

interface ToastProviderProps {
  children: ReactNode;
}

const initialToastState: ToastState = {
  title: "",
  message: undefined,
  isVisible: false,
  duration: 3000,
  variant: "default",
};

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toast, setToast] = useState<ToastState>(initialToastState);

  const showToast = useCallback(
    (title: string, messageOrDuration?: string | number, duration?: number) => {
      setToast({
        ...parseToastArgs(title, 3000, messageOrDuration, duration),
        isVisible: true,
        variant: "default",
      });
    },
    [],
  );

  const showErrorToast = useCallback(
    (title: string, messageOrDuration?: string | number, duration?: number) => {
      setToast({
        ...parseToastArgs(title, 5000, messageOrDuration, duration),
        isVisible: true,
        variant: "error",
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
        title={toast.title}
        message={toast.message}
        isVisible={toast.isVisible}
        onClose={hideToast}
        duration={toast.duration}
        variant={toast.variant}
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
