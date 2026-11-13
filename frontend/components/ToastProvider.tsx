"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";
type Toast = {
  id: number;
  message: string;
  kind: ToastKind;
  exiting: boolean;
};
type ToastContextValue = {
  showToast: (message: string, kind?: ToastKind) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const dismissalTimers = useRef(new Map<number, number>());
  const removalTimers = useRef(new Map<number, number>());

  const dismissToast = useCallback((id: number) => {
    const dismissalTimer = dismissalTimers.current.get(id);
    if (dismissalTimer !== undefined) {
      window.clearTimeout(dismissalTimer);
      dismissalTimers.current.delete(id);
    }

    setToasts((current) =>
      current.map((toast) =>
        toast.id === id ? { ...toast, exiting: true } : toast,
      ),
    );

    const previousRemoval = removalTimers.current.get(id);
    if (previousRemoval !== undefined) window.clearTimeout(previousRemoval);
    const removalTimer = window.setTimeout(() => {
      removalTimers.current.delete(id);
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 250);
    removalTimers.current.set(id, removalTimer);
  }, []);

  const showToast = useCallback(
    (message: string, kind: ToastKind = "success") => {
      const id = ++nextId.current;
      setToasts((current) => [
        ...current,
        { id, message, kind, exiting: false },
      ]);
      dismissalTimers.current.set(
        id,
        window.setTimeout(() => dismissToast(id), 5000),
      );
    },
    [dismissToast],
  );

  useEffect(
    () => () => {
      dismissalTimers.current.forEach((timer) => window.clearTimeout(timer));
      removalTimers.current.forEach((timer) => window.clearTimeout(timer));
    },
    [],
  );

  const contextValue = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="global-toast-region" aria-label="Notifications">
        {toasts.map((toast) => {
          const Icon =
            toast.kind === "error"
              ? CircleAlert
              : toast.kind === "info"
                ? Info
                : CircleCheck;
          return (
            <div
              key={toast.id}
              className={`global-toast global-toast-${toast.kind}${toast.exiting ? " is-exiting" : ""}`}
              role={toast.kind === "error" ? "alert" : "status"}
              aria-live={toast.kind === "error" ? "assertive" : "polite"}
            >
              <Icon size={19} aria-hidden="true" />
              <span>{toast.message}</span>
              <button
                aria-label="Dismiss notification"
                onClick={() => dismissToast(toast.id)}
                type="button"
              >
                <X size={17} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider.");
  }
  return context;
}
