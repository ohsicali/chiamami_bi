import { createContext, useCallback, useContext, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { SPRING_SNAP } from "../../lib/motion";

const ToastContext = createContext(null);

const typeStyles = {
  success: "bg-green-600 text-white",
  error: "bg-red-600 text-white",
  info: "bg-[#FF5757] text-white",
};

const typeIcons = {
  success: (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
    </svg>
  ),
};

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const reduce = useReducedMotion();

  const addToast = useCallback((message, type = "info") => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}

      {/* Toast container.
          Il toast esce esattamente da dove è entrato (stesso y, stessa
          scala): prima entrava da -40 e usciva a -20, due percorsi
          diversi per lo stesso oggetto. Una molla e non dei keyframe
          perché i toast si accavallano — la molla riparte dal valore
          corrente, i keyframe ricomincerebbero da zero. `layout` fa
          scorrere gli altri al posto liberato invece di farli saltare. */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: reduce ? 0 : -24, scale: reduce ? 1 : 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: reduce ? 0 : -24, scale: reduce ? 1 : 0.96 }}
              transition={SPRING_SNAP}
              className={`pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-xs ${typeStyles[toast.type]}`}
              onClick={() => removeToast(toast.id)}
            >
              {typeIcons[toast.type]}
              <span>{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
